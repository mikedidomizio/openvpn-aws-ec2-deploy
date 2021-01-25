import {execSync} from 'child_process';
import log from './helpers/log';
import {Logging} from './helpers/common.interface';

export class SecurityGroup {

    async createGroup(groupName: string, groupDescription: string, vpcId?: string): Promise<string> {
        log(Logging.LOG, 'create a security group with name', groupName);
        try {
            let cmd = `aws ec2 create-security-group --group-name '${groupName}' --description '${groupDescription}'`;

            if (vpcId) {
                cmd += ` --vpc-id ${vpcId}`;
            }

            return execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, stdio: 'pipe' }).toString();
        } catch(e) {
            log(Logging.ERROR, e);
        }
    }

    async getSecurityGroupByName(groupName: string): Promise<string> {
        log(Logging.LOG, 'get a security group by name', groupName);
        try {
            const cmd = `aws ec2 describe-security-groups --group-names="${groupName}"`;
            return execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, stdio: 'pipe' }).toString();
        } catch(e) {
            log(Logging.ERROR, e);
        }
    }

    async addRule(groupId: string, protocol: string, port: number, ip: string): Promise<string> {
        log(Logging.LOG, 'add a rule to security group', groupId, port);
        try {
            const cmd = `aws ec2 authorize-security-group-ingress --group-id '${groupId}' --protocol tcp --port ${port} --cidr ${ip}`;
            return execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, stdio: 'pipe' }).toString();
        } catch(e) {
            log(Logging.ERROR, e);
        }
    }

}
