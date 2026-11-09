<?php
/**
 * BB Projectos — lembretes diários de pagamento.
 *
 * Correr de hora a hora no cPanel → Cron Jobs:
 *     0 * * * *  php /home/USER/public_html/bbproject/cron-reminders.php
 *
 * Uma vez por dia, à hora escolhida na aplicação (Definições → Lembretes), envia uma notificação a
 * cada dispositivo com os lembretes activos: as despesas previstas para hoje em projectos abertos
 * (e para amanhã, se "Também na véspera" estiver ligado), mais as notas marcadas para hoje.
 * Nada previsto → nada enviado.
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

if (!$force && ((int)date('G') < $hour || ($push['lastSent'] ?? '') === $today)) {
    exit("Ainda não é hora (lembretes às {$hour}:00, último envio " . ($push['lastSent'] ?? 'nunca') . ").\n");
}

$tomorrow = date('Y-m-d', strtotime('+1 day'));
[$pending, $allNotes] = openItems($data);

$due = array_values(array_filter($pending, function ($p) use ($today) { return $p['date'] === $today; }));
$next = !empty($settings['remindDayBefore'])
    ? array_values(array_filter($pending, function ($p) use ($tomorrow) { return $p['date'] === $tomorrow; }))
    : [];
$earlier = array_values(array_filter($pending, function ($p) use ($today) { return $p['date'] < $today; }));
$notes = array_values(array_filter($allNotes, function ($n) use ($today) { return ($n['remind'] ?? '') === $today; }));

$message = reminderMessage($due, $next, $earlier, $notes, $settings);
$sent = $message ? pushToAll($message + ['url' => './', 'tag' => 'bbproject-' . $today]) : 0;

withLock(function () use ($today) {
    $store = pushStore();
    $store['lastSent'] = $today;
    writeJson(PUSH_FILE, $store);
});

echo $message ? "Enviado para {$sent} dispositivo(s): {$message['title']}\n" : "Nada previsto para hoje.\n";

/* ---------------------------------------------------------------------- */

/** Despesas por pagar e notas por concluir, de todos os projectos abertos. */
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
            if (empty($n['done'])) {
                $notes[] = $n + ['project' => $p['name']];
            }
        }
    }
    usort($items, function ($a, $b) { return $b['amount'] <=> $a['amount']; });
    return [$items, $notes];
}

function reminderMessage(array $due, array $next, array $earlier, array $notes, array $settings): ?array
{
    if (!$due && !$next && !$notes) {
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

    if ($due) {
        $title = count($due) === 1
            ? 'Pagar hoje: ' . $due[0]['name']
            : count($due) . ' pagamentos previstos hoje · ' . $money($total($due));
        $lines = count($due) === 1 ? [$due[0]['project'] . ' · ' . $money($due[0]['amount'])] : $list($due, 4);
    } elseif ($next) {
        $title = 'Amanhã: ' . (count($next) === 1 ? $next[0]['name'] : count($next) . ' pagamentos previstos');
        $lines = count($next) === 1 ? [$next[0]['project'] . ' · ' . $money($next[0]['amount'])] : $list($next, 4);
    } else {
        $title = count($notes) === 1 ? 'Nota: ' . $notes[0]['title'] : count($notes) . ' notas para hoje';
        $lines = array_map(function ($n) use ($notes) {
            $text = trim(explode("\n", (string)($n['text'] ?? ''))[0]);
            if (count($notes) === 1) {
                return implode(' · ', array_filter([$n['project'], $text]));
            }
            return $n['project'] . ': ' . $n['title'];
        }, array_slice($notes, 0, 4));
        $notes = [];
    }
    if ($due && $next) {
        $lines[] = 'Amanhã: ' . implode(', ', array_column(array_slice($next, 0, 3), 'name')) . (count($next) > 3 ? '…' : '');
    }
    if ($earlier) {
        $lines[] = count($earlier) . ' em atraso';
    }
    if ($notes) {
        $lines[] = 'Notas: ' . implode(', ', array_column(array_slice($notes, 0, 3), 'title')) . (count($notes) > 3 ? '…' : '');
    }
    return ['title' => $title, 'body' => implode("\n", $lines)];
}
