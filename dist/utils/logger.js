const COLORS = {
    reset: '\x1b[0m',
    white: '\x1b[37m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    red: '\x1b[31m'
};
const LEVEL_COLOR = {
    BOOT: COLORS.white,
    READY: COLORS.green,
    WORKER: COLORS.cyan,
    EVENT: COLORS.magenta,
    ERROR: COLORS.red
};
const now = () => new Date().toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});
const colorizeLevel = (level) => `${LEVEL_COLOR[level]}${level}${COLORS.reset}`;
const format = (level, msg) => `[${now()}] [${colorizeLevel(level)}] ${msg}`;
export const logger = {
    boot: (msg) => console.log(format('BOOT', msg)),
    ready: (msg) => console.log(format('READY', msg)),
    worker: (msg) => console.log(format('WORKER', msg)),
    event: (msg) => console.log(format('EVENT', msg)),
    error: (msg, err) => {
        console.error(format('ERROR', msg));
        if (err)
            console.error(err);
    }
};
