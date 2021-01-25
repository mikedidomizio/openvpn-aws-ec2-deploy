import {execSync} from 'child_process';
import log from './helpers/log';
import {Logging} from './helpers/common.interface';

export class KeyPair {

    async create(keyPairName: string): Promise<string> {
        log(Logging.LOG, `create a key pair with ${keyPairName}`);
        const cmd = `aws ec2 create-key-pair --key-name "${keyPairName}" --profile vpn_ec2`;
        try {
            return execSync(cmd, {encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, stdio: 'pipe'}).toString();
        } catch (e) {
            log(Logging.WARN, 'Could not create a key pair, this may be because it already exists and may not be an issue');
        }
    }

}
