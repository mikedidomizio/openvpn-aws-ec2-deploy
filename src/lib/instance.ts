import {execSync} from 'child_process';
import sleep from './helpers/sleep';
import log from './helpers/log';
import {Logging} from './helpers/common.interface';

interface InstanceTag {
    Key: string,
    Value: string,
}

export class Instance {

    async createAndRunInstance(imageId: string, instanceType = 't2.micro', keyPairName: string, instanceTags?: InstanceTag[], securityGroupIds?: string, subnetId?: string): Promise<string> {
        log(Logging.LOG, 'create and run instance');
        let cmd = `aws ec2 run-instances --image-id ${imageId} --count 1 --instance-type ${instanceType} --key-name "${keyPairName}"`;

        if (instanceTags) {
            cmd += ' --tag-specifications';

            for (const tag of instanceTags) {
                if (tag.Key && tag.Value) {
                    cmd += ` ResourceType=instance,Tags=[{Key="${tag.Key}",Value="${tag.Value}"}]`;
                } else {
                    log(Logging.ERROR, 'cannot add tag without a proper key/value, ignoring adding it');
                }
            }
        }

        if (securityGroupIds) {
            cmd += ` --security-group-ids ${securityGroupIds}`;
        }

        if (subnetId) {
            cmd += ` --subnet-id ${subnetId}`;
        }

        return execSync(cmd, {maxBuffer: 50 * 1024 * 1024}).toString();
    }

    async pollForInstanceRunningByInstanceId(instanceId: string, numberOfRetriesLeft = 10): Promise<(instanceId: string, numberOfRetriesLeft: number) => void> {
        log(Logging.LOG, 'poll for instance running');
        const cmd = `aws ec2 describe-instances --filters "Name=instance-id,Values=${instanceId}" --query "Reservations[].Instances[].State.Code"`;
        const result = await execSync(cmd, {maxBuffer: 50 * 1024 * 1024}).toString().replace(/[\r\n\s]/g, '');
        const parsedResult = JSON.parse(result);

        // `running` code is 16
        if (parsedResult[0] === 16) {
            return;
        } else {
            if (numberOfRetriesLeft > 0) {
                log(Logging.LOG, 'Waiting for instance running, sleep for 10 seconds');

            } else {
                throw new Error(`Instance is not running, check manually, cmd: ${cmd}`)
            }
            await sleep(10000);
            numberOfRetriesLeft--;
            return this.pollForInstanceRunningByInstanceId(instanceId, numberOfRetriesLeft);
        }
    }

    async pollForPublicIpByInstanceId(instanceId: string, numberOfRetriesLeft = 10): Promise<string> {
        log(Logging.LOG, 'poll for public IP assigned');
        const cmd = `aws ec2 describe-instances --filters "Name=instance-id,Values=${instanceId}" --query "Reservations[].Instances[].NetworkInterfaces[].Association.PublicIp"`;
        const result = await execSync(cmd, {maxBuffer: 50 * 1024 * 1024}).toString().replace(/[\r\n\s]/g, '');
        const parsedResult = JSON.parse(result);

        if (parsedResult && parsedResult.length) {
            return parsedResult[0];
        } else {
            if (numberOfRetriesLeft > 0) {
                log(Logging.LOG,'Waiting for Public IP, sleep for 5 seconds');

            } else {
                throw new Error(`Did not get public ip, cmd: ${cmd}`)
            }
            await sleep(5000);
            numberOfRetriesLeft--;
            return this.pollForPublicIpByInstanceId(instanceId, numberOfRetriesLeft);
        }
    }

}
