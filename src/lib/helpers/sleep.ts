import {Logging} from './common.interface';
import log from './log';

export default function sleep(ms: number, msg?: string) {
    return new Promise((resolve) => {
        if (msg) {
            log(Logging.LOG, msg);
        }
        setTimeout(resolve, ms);
    });
}
