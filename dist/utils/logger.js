const now = () => new Date().toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});
const format = (level, msg) => `[${now()}] [${level}] ${msg}`;
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
