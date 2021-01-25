import {Instance} from "./lib/instance";
import {CONSTANTS} from "./const";

/**
 * Proceeds to terminate all instances by tag key name
 */
(async() => {
    await new Instance().terminateInstanceByTagKey(CONSTANTS.TAG_KEY_NAME);
})();
