import log from './helpers/log';
import {Logging} from './helpers/common.interface';
import * as rp from 'request-promise';
import * as fs from 'fs';
import sleep from "./helpers/sleep";

// OpenVPN webportal has some additional headers required
const openVPNHeaders = {
    'X-CWS-Proto-Ver': 2,
    'X-OpenVPN': 1,
};

export class OvpnWeb {

    private cookieJar = rp.jar();

    constructor(private ipAddress: string) {
    }

    async pollWebPortalIsUp(numberOfRetriesLeft = 10): Promise<string> {
        log(Logging.LOG, 'poll for web portal up, sleep for 5 seconds');
        await sleep(5000);

        try {
            // this is the perfect request to make as we require to have the cookie created before we can attempt
            // a log in
            return this.getCookie();
        } catch(e) {
            if (numberOfRetriesLeft <= 0) {
                throw new Error(`Web portal is not up?: ${this.ipAddress}`);
            }
            numberOfRetriesLeft--;
            return this.pollWebPortalIsUp(numberOfRetriesLeft);
        }
    }

    async downloadOpenVpnClient(username: string, password: string): Promise<void> {
        log(Logging.LOG, 'download client vpn from web portal');
        await this.login(username, password);
        // cookie should be validated at this point
        const openVPNClientDownloadUrl = await this.getDownloadURL();
        return this.initiateDownloadAndSaveFile(openVPNClientDownloadUrl, './client.ovpn');
    }

    private async login(username: string, password: string) {
        log(Logging.LOG, 'login to client web portal');
        const options = {
            uri: `https://${this.ipAddress}/__auth__`,
            jar: this.cookieJar,
            method: 'POST',
            headers: openVPNHeaders,
            rejectUnauthorized: false,
            followAllRedirects: true,
            form: {
                username,
                password,
            },
            resolveWithFullResponse: true,
        };
        const response = await rp(options);

        if (!response.body.includes('Succeeded')) {
            throw new Error('Could not log into OpenVPN web portal');
        }
    }

    private async initiateDownloadAndSaveFile(downloadUrl: string, pathToSave: string): Promise<void>  {
        log(Logging.LOG, `initiate download of client, saving to '${pathToSave}'`);
        const options = {
            uri: downloadUrl,
            method: 'GET',
            jar: this.cookieJar,
            encoding: 'binary',
            headers: openVPNHeaders,
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
        };

        const downloadResponse = await rp(options);
        if (downloadResponse.statusCode === 200) {
            fs.writeFileSync(pathToSave, downloadResponse.body);
            log(Logging.SUCCESS, '\u2713 Successfully downloaded client and saved');
            return;
        }

        throw new Error('Could not download file');
    }

    private async getDownloadURL(): Promise<string> {
        log(Logging.LOG, 'get openvpn client download url');
        const options = {
            uri: `https://${this.ipAddress}/downloads.json`,
            jar: this.cookieJar,
            method: 'POST',
            headers: openVPNHeaders,
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            followAllRedirects: true,
        };

        const response = await rp(options);

        if (response.statusCode === 200) {
            const removeJSONHijackingCounteremeasure = response.body.replace(/^\)\]\}\'/, '');
            const parsedDownloadResponse = JSON.parse(removeJSONHijackingCounteremeasure);
            const client = parsedDownloadResponse.settings.userlocked;
            return `https://${this.ipAddress}/${client}`;
        }

        throw new Error('Could not get download URL');
    }

    private async getCookie(): Promise<string> {
        log(Logging.LOG, 'get cookie from client web portal');
        const options = {
            uri: `https://${this.ipAddress}/?src=connect`,
            jar: this.cookieJar,
            headers: openVPNHeaders,
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
        };

        await rp(options);
        const cookie = this.cookieJar.getCookies(`https://${this.ipAddress}`);

        if (cookie.length) {
            return cookie[0];
        }

        throw new Error('Could not get cookie from OpenVPN web portal');
    }
}
