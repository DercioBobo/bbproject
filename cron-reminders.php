<?php
/**
 * BB Projectos — lembretes diários de pagamentos e actividades.
 *
 * Correr de hora a hora no cPanel → Cron Jobs:
 *     0 * * * *  php /home/USER/public_html/bbproject/cron-reminders.php
 *
 * Uma vez por dia, à hora escolhida na aplicação (Definições → Lembretes), envia uma notificação a
 * cada dispositivo com os lembretes activos: as despesas e actividades previstas para hoje em
 * projectos abertos (e para amanhã, se "Também na véspera" estiver ligado). Uma actividade em atraso
 * continua a ser lembrada todos os dias até ser marcada como feita ou mudar de data.
 * Nada previsto → nada enviado.
 *
 * Em cada hora, as actividades com hora marcada têm um aviso próprio, 30 a 90 minutos antes.
 *
 * Testar à mão:  php cron-reminders.php --now   (envia logo, ignora a hora)
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}

define('BBPROJECT_LIB', true);
require __DIR__ . '/api.php';

$force = in_array('--now', $argv ?? [], true);

$data = readJson(DATA_FILE)['data'] ?? null;
$push = withLock('pushStore');
if (!$data || !$push['subs']) {
    exit("Nada a fazer: sem dados ou sem dispositivos com lembretes activos.\n");
}

$settings = $data['settings'] ?? [];
date_default_timezone_set($push['tz'] ?? 'Africa/Maputo');
$today = date('Y-m-d');
$hour = (int)($settings['remindHour'] ?? 8);

[$pending, $activities] = openItems($data);
$digestDue = $force || ((int)date('G') >= $hour && ($push['lastSent'] ?? '') !== $today);

$alreadySent = $push['sentTimed'] ?? [];
$soon = array_values(array_filter(timedDue($activities, time()), function ($n) use ($alreadySent) {
    return !in_array(timedKey($n), $alreadySent, true);
}));
// O lembrete diário que sai agora já fala das actividades de hoje.
$timed = $digestDue
    ? array_values(array_filter($soon, function ($n) use ($today) { return $n['remind'] !== $today; }))
    : $soon;
if ($timed) {
    $timedText = timedMessage($timed);
    $sentTimed = pushToAll($timedText + ['url' => './', 'tag' => 'bbproject-hora-' . date('YmdH')]);
    echo "Enviado para {$sentTimed} dispositivo(s): {$timedText['title']}\n";
}
if ($soon) {
    withLock(function () use ($soon, $today) {
        $store = pushStore();
        $keys = array_merge($store['sentTimed'] ?? [], array_map('timedKey', $soon));
        $store['sentTimed'] = array_values(array_filter($keys, function ($k) use ($today) { return substr($k, 0, 10) >= $today; }));
        writeJson(PUSH_FILE, $store);
    });
}

if (!$digestDue) {
    exit("Ainda não é hora do lembrete diário (às {$hour}:00, último envio " . ($push['lastSent'] ?? 'nunca') . ").\n");
}

$tomorrow = date('Y-m-d', strtotime('+1 day'));
$dayBefore = !empty($settings['remindDayBefore']);

$due = array_values(array_filter($pending, function ($p) use ($today) { return $p['date'] === $today; }));
$next = $dayBefore
    ? array_values(array_filter($pending, function ($p) use ($tomorrow) { return $p['date'] === $tomorrow; }))
    : [];
$earlier = array_values(array_filter($pending, function ($p) use ($today) { return $p['date'] < $today; }));

$todo = array_values(array_filter($activities, function ($n) use ($today) { return $n['remind'] === $today; }));
$todoNext = $dayBefore
    ? array_values(array_filter($activities, function ($n) use ($tomorrow) { return $n['remind'] === $tomorrow; }))
    : [];
$todoLate = array_values(array_filter($activities, function ($n) use ($today) { return $n['remind'] < $today; }));

$message = reminderMessage($due, $next, $earlier, $todo, $todoNext, $todoLate, $settings);
$sent = $message ? pushToAll($message + ['url' => './', 'tag' => 'bbproject-' . $today]) : 0;

withLock(function () use ($today) {
    $store = pushStore();
    $store['lastSent'] = $today;
    writeJson(PUSH_FILE, $store);
});

echo $message ? "Enviado para {$sent} dispositivo(s): {$message['title']}\n" : "Nada previsto para hoje.\n";

/* ---------------------------------------------------------------------- */

/** Despesas por pagar e actividades com data por fazer, de todos os projectos abertos. */
function openItems(array $data): array
{
    $items = [];
    $notes = [];
    foreach ($data['projects'] ?? [] as $p) {
        if (($p['status'] ?? 'open') === 'closed') {
            continue;
        }
        $cats = [];
        foreach ($p['categories'] ?? [] as $c) {
            $cats[$c['id']] = $c['name'];
        }
        foreach ($p['entries'] ?? [] as $e) {
            if (empty($e['paid']) && ($e['type'] ?? '') === 'expense') {
                $name = trim((string)($e['note'] ?? '')) ?: ($cats[$e['category'] ?? ''] ?? 'Despesa');
                $items[] = ['name' => $name, 'project' => $p['name'], 'amount' => (float)($e['amount'] ?? 0), 'date' => $e['date']];
            }
        }
        foreach ($p['notes'] ?? [] as $n) {
            if (empty($n['done']) && !empty($n['remind'])) {
                $notes[] = $n + ['project' => $p['name']];
            }
        }
    }
    usort($items, function ($a, $b) { return $b['amount'] <=> $a['amount']; });
    return [$items, $notes];
}

/**
 * Actividades com hora que cabem nesta ronda: de meia hora a hora e meia depois do início da hora actual.
 * Cada hora do dia cai em exactamente uma ronda, mesmo que o cron arranque uns minutos atrasado.
 */
function timedDue(array $activities, int $now): array
{
    $from = strtotime(date('Y-m-d H:00:00', $now)) + 1800;
    $until = $from + 3600;
    $soon = array_values(array_filter($activities, function ($n) use ($from, $until) {
        if (!preg_match('/^\d{2}:\d{2}$/', (string)($n['time'] ?? ''))) {
            return false;
        }
        $at = strtotime($n['remind'] . ' ' . $n['time'] . ':00');
        return $at >= $from && $at < $until;
    }));
    usort($soon, function ($a, $b) { return strcmp($a['remind'] . $a['time'], $b['remind'] . $b['time']); });
    return $soon;
}

/** Identifica um aviso já enviado; começa pela data para se poder limpar os antigos. */
function timedKey(array $n): string
{
    return $n['remind'] . ' ' . $n['time'] . ' ' . ($n['id'] ?? $n['title']);
}

function timedMessage(array $items): array
{
    if (count($items) === 1) {
        $n = $items[0];
        $detail = trim(explode("\n", (string)($n['text'] ?? ''))[0]);
        return ['title' => 'Às ' . $n['time'] . ': ' . $n['title'], 'body' => implode(' · ', array_filter([$n['project'], $detail]))];
    }
    $lines = array_map(function ($n) { return $n['time'] . ' ' . $n['title'] . ' (' . $n['project'] . ')'; }, $items);
    return ['title' => count($items) . ' actividades em breve', 'body' => implode("\n", $lines)];
}

function reminderMessage(array $due, array $next, array $earlier, array $todo, array $todoNext, array $todoLate, array $settings): ?array
{
    if (!$due && !$next && !$todo && !$todoNext && !$todoLate) {
        return null;
    }
    $money = function (float $n) use ($settings): string {
        if ($n <= 0) {
            return 'sem valor';
        }
        return number_format($n, (int)($settings['decimals'] ?? 2), ',', ' ') . ' ' . ($settings['currency'] ?? 'MT');
    };
    $list = function (array $items, int $max) use ($money): array {
        $lines = array_map(function ($p) use ($money) { return $p['project'] . ': ' . $p['name'] . ' · ' . $money($p['amount']); }, array_slice($items, 0, $max));
        if (count($items) > $max) {
            $lines[] = 'e mais ' . (count($items) - $max);
        }
        return $lines;
    };
    $total = function (array $items): float { return array_sum(array_column($items, 'amount')); };
    // Uma actividade sozinha mostra o projecto e os detalhes; várias, uma linha cada.
    $tasks = function (array $items): array {
        $lines = array_map(function ($n) use ($items) {
            if (count($items) === 1) {
                return implode(' · ', array_filter([$n['project'], trim(explode("\n", (string)($n['text'] ?? ''))[0])]));
            }
            return $n['project'] . ': ' . (!empty($n['time']) ? $n['time'] . ' ' : '') . $n['title'];
        }, array_slice($items, 0, 4));
        if (count($items) > 4) {
            $lines[] = 'e mais ' . (count($items) - 4);
        }
        return $lines;
    };
    $titles = function (array $items): string {
        return implode(', ', array_map(function ($n) {
            return (!empty($n['time']) ? $n['time'] . ' ' : '') . $n['title'];
        }, array_slice($items, 0, 3))) . (count($items) > 3 ? '…' : '');
    };
    $at = function (string $day, array $n): string {
        return $day . (!empty($n['time']) ? ' às ' . $n['time'] : '') . ': ' . $n['title'];
    };
    $activityCount = function (int $n): string { return $n === 1 ? '1 actividade' : $n . ' actividades'; };

    if ($due) {
        $title = count($due) === 1
            ? 'Pagar hoje: ' . $due[0]['name']
            : count($due) . ' pagamentos previstos hoje · ' . $money($total($due));
        $lines = count($due) === 1 ? [$due[0]['project'] . ' · ' . $money($due[0]['amount'])] : $list($due, 4);
    } elseif ($todo) {
        $title = count($todo) === 1 ? $at('Hoje', $todo[0]) : $activityCount(count($todo)) . ' para hoje';
        $lines = $tasks($todo);
        $todo = [];
    } elseif ($next) {
        $title = 'Amanhã: ' . (count($next) === 1 ? $next[0]['name'] : count($next) . ' pagamentos previstos');
        $lines = count($next) === 1 ? [$next[0]['project'] . ' · ' . $money($next[0]['amount'])] : $list($next, 4);
    } elseif ($todoNext) {
        $title = count($todoNext) === 1 ? $at('Amanhã', $todoNext[0]) : $activityCount(count($todoNext)) . ' para amanhã';
        $lines = $tasks($todoNext);
        $todoNext = [];
    } else {
        $title = count($todoLate) === 1 ? 'Em atraso: ' . $todoLate[0]['title'] : $activityCount(count($todoLate)) . ' em atraso';
        $lines = $tasks($todoLate);
        $todoLate = [];
    }
    if ($due && $next) {
        $lines[] = 'Amanhã: ' . implode(', ', array_column(array_slice($next, 0, 3), 'name')) . (count($next) > 3 ? '…' : '');
    }
    if ($earlier) {
        $lines[] = (count($earlier) === 1 ? '1 pagamento' : count($earlier) . ' pagamentos') . ' em atraso';
    }
    if ($todo) {
        $lines[] = 'Hoje: ' . $titles($todo);
    }
    if ($todoNext) {
        $lines[] = 'Amanhã: ' . $titles($todoNext);
    }
    if ($todoLate) {
        $lines[] = $activityCount(count($todoLate)) . ' em atraso';
    }
    return ['title' => $title, 'body' => implode("\n", $lines)];
}
