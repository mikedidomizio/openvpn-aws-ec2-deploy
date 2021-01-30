import {execSync} from 'child_process';
import sleep from './helpers/sleep';
import log from './helpers/log';
import {Logging} from './helpers/common.interface';

interface InstanceTag {
    Key: string,
    Value: string,
}

enum InstanceCode {
    Running = 16
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

    async terminateInstanceByTagKey(keyName: string): Promise<void> {
        log(Logging.LOG, `terminating instances by key name: ${keyName}`);
        const instanceIds: string[] =  await this.listInstancesByTagKeyReturnInstanceIds(keyName);
        let cmd = 'aws ec2 terminate-instances --instance-ids';
        cmd += ` ${instanceIds.join(' ')}`;
        await execSync(cmd, {maxBuffer: 50 * 1024 * 1024}).toString();
        log(Logging.LOG, `terminated instances: ${instanceIds.join(' ')}`);
    }

    async listInstancesByTagKeyReturnInstanceIds(keyName: string): Promise<string[]> {
        log(Logging.LOG, `list EC2 instances by tag key ${keyName}`);
        const cmd = 'aws ec2 describe-instances --filters "Name=tag-key,Values=OpenVPN server" --query "Reservations[].Instances[].{Instance:InstanceId}"';
        const instanceIdsObj = JSON.parse(execSync(cmd, {maxBuffer: 50 * 1024 * 1024}).toString()) as { Instance: string}[];
        return instanceIdsObj.map(i => `${i.Instance}`);
    }

    async pollForInstanceRunningByInstanceIdReturnIp(instanceId: string, instanceType = 't2.micro', numberOfRetriesLeft = 10) {
        log(Logging.LOG, 'poll for instance running, sleep for 10 seconds');
        await sleep(10000);

        const cmd = `aws ec2 describe-instances\
        --filters Name=instance-id,Values=${instanceId} Name=instance-type,Values=${instanceType}\
        --query "Reservations[].Instances[].{ Code: State.Code, PublicIp: NetworkInterfaces[0].Association.PublicIp }"`;
        const result = await execSync(cmd, {maxBuffer: 50 * 1024 * 1024}).toString().replace(/[\r\n\s]/g, '');
        const parsedResult = JSON.parse(result);

        if (parsedResult[0] && parsedResult[0].Code === InstanceCode.Running && parsedResult[0].PublicIp !== null) {
            return parsedResult[0].PublicIp;
        } else {
            if (numberOfRetriesLeft <= 0) {
                throw new Error(`Instance is not running or not assigned IP, check manually, cmd: ${cmd}`)
            }
            numberOfRetriesLeft--;
            return this.pollForInstanceRunningByInstanceIdReturnIp(instanceId, instanceType, numberOfRetriesLeft);
        }
    }
}
