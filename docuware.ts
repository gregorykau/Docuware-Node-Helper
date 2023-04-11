/**
 * Docuware Helper
 * 2023 Kian Gregory
 * 
 * To be called from the command line or programmatically with the DocuwareHelper namespace and it's exposed functions.
 * 
 * All calls require an endpoint -e, and either a token -t or cookie -x (except for the authentication requests)
 * 
 * It may be useful to generate and then re-use cookies in subsequent calls when your license does not allow for multiple active sessions.
 * 
 * Authentication: 
 *  Generating a token for re-use:
 *      node docuware.js -m gentoken -u "username" -p "password" -h "123-456-789-xxxx-xxxx" -e "https://test.docuware.cloud"
 *  Generating a cookie for re-use:
 *      node docuware.js -m gencookie -u "username" -p "password" -h "123-456-789-xxxx-xxxx" -e "https://test.docuware.cloud"
 * 
 * Cabinet Listing:
 *  node docuware.js -m lscabinets -e "https://test.docuware.cloud" -t "ABC"
 * 
 * Geting document/s (JSON):
 *  With a server-side query -q:
 *      node docuware.js -c "Meter - STG" -m get -q "SERIAL_NO = [3080RC20119]" -e "https://test.docuware.cloud" -t "ABC"
 *  With a client-side predicate -f: (NOTE: this will cause ALL records from cabinet to be fetched and filtered locally)
 *      node docuware.js -c "Meter - STG" -m get -f "fields['SERIAL_NO'] == '3080RC20114'" -e "https://test.docuware.cloud" -t "ABC"
 *  With a provided docuware ID -i: 
 *      node docuware.js -c "Meter - STG" -m get -i 1 -e "https://test.docuware.cloud" -t "ABC"
 *  
 * Downloading document/s (save PDF):
 *  With a server-side query -q:
 *      node docuware.js -c "Meter - STG" -m download -q "SERIAL_NO = [3080RC20114]" -n "testdoc" -p "C:\Users\kgregory\Documents\GitHub\ricohmy\tmp" -e "https://test.docuware.cloud" -t "ABC"
 *  With a client-side predicate -f: (NOTE: this will cause ALL records from cabinet to be fetched and filtered locally)
 *      node docuware.js -c "Meter - STG" -m download -f "fields['SERIAL_NO'] == '3080RC20114'" -n "testdoc" -p "C:\Users\kgregory\Documents\GitHub\ricohmy\tmp" -e "https://test.docuware.cloud" -t "ABC"
 *  With a provided docuware ID -i: 
 *      node docuware.js -c "Meter - STG" -m download -i 1 -n "testdoc" -p "C:\Users\kgregory\Documents\GitHub\ricohmy\tmp" -e "https://test.docuware.cloud" -t "ABC"
 *  
 * Updating a document (from JSON):
 *  With a server-side query -q:
 *      node docuware.js -c "Meter - STG" -m update -q "SERIAL_NO = [3080RC20114]" -u "{'SERIAL_NO': '3080RC20119'}" -e "https://test.docuware.cloud" -t "ABC"
 *  With a client-side predicate -f: (NOTE: this will cause ALL records from cabinet to be fetched and filtered locally)
 *      node docuware.js -c "Meter - STG" -m update -f "fields['SERIAL_NO'] == '3080RC20114'" -u "{'SERIAL_NO': '3080RC20119'}" -e "https://test.docuware.cloud" -t "ABC"
 *  With a provided docuware ID -i: 
 *      node docuware.js -c "Meter - STG" -m update -i 1 -u "{'SERIAL_NO': '3080RC20119'}" -e "https://test.docuware.cloud" -t "ABC"
 * 
 * Uploading a document (with PDF):
 *  node docuware.js -c "Meter - STG" -m upload -p "C:\Users\kgregory\Desktop\TEST DOCUMENT.pdf" -e "https://test.docuware.cloud" -t "ABC"
 */

import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url'

import axios from "axios";
import FormData from "form-data";
import qs from "qs";
import minimist from "minimist";
import { Stream } from "stream";

const args = minimist(process.argv.slice(2));

namespace UtilFunctions {
    export function delay(inSeconds: number): Promise<void> { 
        return new Promise((resolve) => setTimeout(resolve, 1000 * inSeconds));
    }
}

interface Globals {
    endpoint: string,
    cookie: string,
    retryMaxCount: number,
    retryDelayBaseInSeconds: number,
    retryDelayRandomMinInSeconds: number,
    retryDelayRandomMaxInSeconds: number
};

const GLOBALS: Globals = {
    endpoint: '',
    cookie: '',
    retryMaxCount: 100,
    retryDelayBaseInSeconds: 10,
    retryDelayRandomMinInSeconds: 10,
    retryDelayRandomMaxInSeconds: 20
}

function formatCookie(cookieStr: any): string {
    const cookieObj = cookieStr.reduce((obj: any, cookie: string) => {
        const matches = cookie.match(/^([^=]+)=([^;]+);/);
        if (matches)
            obj[matches[1]] = matches[2];
        return obj;
    }, {});

    const formattedCookieStr = Object.keys(cookieObj)
        .map((cookie) => cookie + '=' + cookieObj[cookie])
        .join('; ')
        .trim();

    return formattedCookieStr;
}

// for usage as a module:
export namespace DocuwareHelper {
    export async function generateToken(username: string, password: string, hostID: string, endpoint: string): Promise<string> {
        GLOBALS.endpoint = endpoint;

        // login with user / pass
        let loginCookie = '';
        {
            const data = new FormData();
            data.append('Username', username);
            data.append('Password', password);
            data.append('Organization', 'Peters Engineering');
            data.append('HostID', hostID);
            data.append('RedirectToMyselfInCaseOfError', 'false');
            data.append('RememberMe', 'true');
            
            const response = await axios({
                method: 'post',
                url: `${GLOBALS.endpoint}/docuware/platform/Account/Logon`,
                headers: { 
                    'Accept': 'application/json', 
                    ...data.getHeaders()
                },
                data: data
            });
            loginCookie = formatCookie(response.headers['set-cookie']);
        }
    
        // get token
        let token = '';
        {
            const response = await axios(
                {
                    method: 'post',
                    url: `${GLOBALS.endpoint}/docuware/platform/Organization/LoginToken`,
                    headers: { 
                        'Accept': 'application/json', 
                        'Content-Type': 'application/json', 
                        'Cookie': loginCookie
                    },
                    data: JSON.stringify({
                        "TargetProducts": [
                            "PlatformService"
                        ],
                        "Usage": "Multi",
                        "Lifetime": "1.00:00:00"
                    })
                }
            );
            token = response.data;
        }
    
        GLOBALS.cookie = loginCookie;
    
        return token;
    }
    
    export async function initAuthFromToken(token: string, endpoint: string): Promise<string> {
        GLOBALS.endpoint = endpoint;

        let tokenCookie = '';
        {
            const response = await axios({
                method: 'post',
                url: `${GLOBALS.endpoint}/docuware/platform/Account/TokenLogOn`,
                headers: { 
                    'Accept': 'application/json', 
                    'Content-Type': 'application/x-www-form-urlencoded', 
                    'Cookie': GLOBALS.cookie
                },
                data: qs.stringify({
                    'Token': token,
                    //'HostID': GLOBALS.HostID,
                    'LicenseType': 'PlatformService',
                    'RememberMe': 'false' 
                })
            })
            tokenCookie = formatCookie(response.headers['set-cookie']);
        }
    
        GLOBALS.cookie = tokenCookie;
        return tokenCookie;
    }

    export async function initAuthFromCreds(username: string, password: string, hostID: string, endpoint: string): Promise<string> {
        const token: string = await generateToken(username, password, hostID, endpoint);
        await initAuthFromToken(token, endpoint);
        return GLOBALS.cookie;
    }
    
    export async function getRequest(url: string, responseType: any = undefined): Promise<any> {
        for (let i = 0; i < GLOBALS.retryMaxCount; i++) {
            try {
                const res: any = await axios(
                    {
                        method: 'get',
                        url: `${GLOBALS.endpoint}/${url}`,
                        headers: { 
                            'Accept': 'application/json',
                            'Cookie': GLOBALS.cookie
                        },
                        responseType: responseType,
                        validateStatus: (status) => true
                    }
                );
                if (res.status == 200) {
                    return res.data;
                } else {
                    // too many requests, try again after a delay
                    await UtilFunctions.delay(GLOBALS.retryDelayBaseInSeconds + Math.floor((GLOBALS.retryDelayRandomMaxInSeconds - GLOBALS.retryDelayRandomMinInSeconds) * Math.random()));
                    continue;
                }
            } catch (ex) {
                console.log(ex);
                return null;
            }
        }
    }
    
    export async function postRequest(url: string, data: any, contentType: any = undefined): Promise<any> {
        for (let i = 0; i < GLOBALS.retryMaxCount; i++) {
            try {
                const res: any = await axios(
                    {
                        method: 'post',
                        url: `${GLOBALS.endpoint}/${url}`,
                        headers: { 
                            'Content-Type': contentType,
                            'Accept': 'application/json',
                            'Cookie': GLOBALS.cookie
                        },
                        validateStatus: (status) => true,
                        data: data
                    }
                );
                if (res.status == 200) {
                    return res.data;
                } else {
                    // too many requests, try again after a delay
                    await UtilFunctions.delay(GLOBALS.retryDelayBaseInSeconds + Math.floor((GLOBALS.retryDelayRandomMaxInSeconds - GLOBALS.retryDelayRandomMinInSeconds) * Math.random()));
                    continue;
                }
            } catch (ex) {
                console.log(ex);
                return null;
            }
        }
        return null;
    }
    
    export async function getOrganizations(): Promise<Array<any>> {
        return getRequest("docuware/platform/Organizations");
    }
    
    export async function getFileCabinets(orgId: string): Promise<Array<any>> {
        return (await getRequest(`docuware/platform/FileCabinets?orgid=${orgId}`)).FileCabinet;
    }
    
    export async function getFileCabinet(fileCabinetId: string): Promise<any> {
        return getRequest(`docuware/platform/FileCabinets/${fileCabinetId}`)
    }

    export async function getCabinetIDsFromName(cabinetName: string): Promise<Array<string>> {
        const cabinets = await DocuwareHelper.getFileCabinets('1');
        const matchingCabinets = cabinets.filter((cabinet: any) => cabinet.Name == cabinetName).map(x => x.Id);
        return matchingCabinets;
    }
    
    export async function getAllDocumentsFromCabinet(fileCabinetId: string): Promise<Array<any>> {
        const batchRequestCount: number = 1000;
        let start: number = 0;
        let documents: Array<any> = [];
        let headers: any = null;
        while (true) {
            let fetchedDocuments = await getRequest(`docuware/platform/FileCabinets/${fileCabinetId}/Documents?format=table&start=${start}&count=${batchRequestCount}`);
            if (!headers)
                headers = fetchedDocuments['Headers'].map((header: any) => header['FieldName']);
            if (!fetchedDocuments['Rows'] || (fetchedDocuments['Rows'].length == 0))
                break;
            const processedDocuments: Array<any> = fetchedDocuments['Rows'].map((row: any) => {
                const fieldsMap: any = {}
                row['Items'].forEach((item: any, idx: number) => fieldsMap[headers[idx]] = item);
                return {
                    id: fieldsMap['DWDOCID'],
                    cabinetId: fileCabinetId,
                    row: fieldsMap
                };
            })
            documents.push(...processedDocuments);
            start += batchRequestCount;
        }
        return documents;
    }
    
    export async function downloadDocument(fileCabinetId: string, documentId: string): Promise<Stream> {
        const dataStream: Stream = await getRequest(`docuware/platform/FileCabinets/${fileCabinetId}/Documents/${documentId}/FileDownload?targetFileType=Auto&keepAnnotations=false`, 'stream');
        return dataStream;
    }
    
    export async function uploadDocument(fileCabinetId: string, filePath: string): Promise<any> {
        const formData = new FormData();
        const readStream =  fs.createReadStream(filePath);
        formData.append('file', readStream);
        const data = await postRequest(`docuware/platform/FileCabinets/${fileCabinetId}/Documents`, formData, 'multipart/form-data');
        readStream.close();
    
        return data;
    }
    
    export async function updateDocument(fileCabinetId: string, documentId: string, jsonFields: Record<string, any>): Promise<any> {
        const fieldData = JSON.stringify({
            Field: Object.keys(jsonFields).map(field => ({
                FieldName: field,
                Item: jsonFields[field],
                ItemElementName: "String"
            }))}
        );
        const data = await postRequest(`docuware/platform/FileCabinets/${fileCabinetId}/Documents/${documentId}/Fields`, fieldData, 'application/json');
        return data;
    }
    
    export async function getDocument(cabinetId: string, id: string): Promise<any> {
        const data: any = await getRequest(`docuware/platform/FileCabinets/${cabinetId}/Documents/${id}`);
    
        const row = data.Fields.reduce((obj: any, field: any) => {
            obj[field.FieldName] = field.Item || "";
            return obj;
        }, {});
    
        return {
            id: id,
            cabinetId: cabinetId,
            row: row
        }
    }
    
    export async function getDocumentsWithFunction(cabinetId: string, downloadFunctionStr: string): Promise<Array<any>> {
        const predicateFunction = Function("fields", `return ${downloadFunctionStr}`);
        const documents = (await getAllDocumentsFromCabinet(cabinetId)).filter(document => predicateFunction(document.row));
        return documents;
    }
    
    export async function getDocumentsWithQuery(cabinetId: string, downloadQueryStr: string): Promise<Array<any>> {
        const jsonBody = {
            "Condition": downloadQueryStr.split('|').map((conditionStr: string) => {
                let [key, value] = conditionStr.split('=').map(x => x.trim());
                value = value.slice(1, -1); // remove []
                return {
                    "DBName": key, "Value": [value]
                };
            }),
            "Operation": "Or"
        };
        const res = await postRequest(`docuware/platform/FileCabinets/${cabinetId}/Query/DialogExpressionLink`, jsonBody, 'application/json');
    
        const queryLink = res.substring(1);
    
        const fetchedDocuments = await getRequest(queryLink);
    
        if (fetchedDocuments.Count.Value == 0)
            return [];
        
        const headers = fetchedDocuments.Items[0].Fields.map((field: any) => field.FieldName);
        const documents = fetchedDocuments.Items.map((row: any) => {
            const fieldsMap: any = {}
            row['Fields'].forEach((field: any, idx: number) => fieldsMap[headers[idx]] = field.Item);
            return {
                id: fieldsMap['DWDOCID'],
                cabinetId: cabinetId,
                row: fieldsMap
            }
        });
    
        return documents;
    }
}

// for calling via CMD: 
namespace DocuwareCMD {
    export async function execute() {
        if (args['retrymax'] && !isNaN(args['retrymax']))
            GLOBALS.retryMaxCount = Number(args['retrymax']);
        if (args['retrybase'] && !isNaN(args['retrybase']))
            GLOBALS.retryDelayBaseInSeconds = Number(args['retrybase']);
        if (args['retryrandmin'] && !isNaN(args['retryrandmin']))
            GLOBALS.retryDelayRandomMinInSeconds = Number(args['retryrandmin']);
        if (args['retryrandmax'] && !isNaN(args['retryrandmax']))
            GLOBALS.retryDelayRandomMaxInSeconds = Number(args['retryrandmax']);

        const mode = args['m'];
        if (!mode) {
            console.log(`-m mode not defined.`); 
            return; 
        }
    
        const endpoint = args['e'];
        GLOBALS.endpoint = endpoint;
        if (!endpoint) {
            console.log(`-e endpoint not defined.`); 
            return; 
        }
    
        if (mode == 'gencookie') {
            const username = args['u'];
            const password = args['p'];
            const hostID = args['h'];
            if (!username) { console.log('-u username not defined.'); return; }
            if (!password) { console.log('-p password not defined.'); return; }
            if (!hostID) { console.log('-h hostname not defined.'); return; }
            await DocuwareHelper.initAuthFromCreds(username, password, hostID, endpoint);
            console.log(GLOBALS.cookie);
            return;
        }
    
        if (mode == 'gentoken') {
            const username = args['u'];
            const password = args['p'];
            const hostID = args['h'];
            if (!username) { console.log('-u username not defined.'); return; }
            if (!password) { console.log('-p password not defined.'); return; }
            if (!hostID) { console.log('-h hostname not defined.'); return; }
    
            const token = await DocuwareHelper.generateToken(username, password, hostID, endpoint);
            console.log(token);
            return;
        }
    
        const cookie = args['x'];
        const token = args['t'];
        if (!token && !cookie) {
            console.log(`neither token -t nor cookie -c defined.`); 
            return; 
        }
        if (token && cookie) {
            console.log(`both cookie and token were provided... using existing cookie.`);
            return;
        }
    
        if (token && !cookie) {
            await DocuwareHelper.initAuthFromToken(token, endpoint);
        } else {
            GLOBALS.cookie = cookie;
        }
    
        const cabinets = await DocuwareHelper.getFileCabinets('1');
    
        if (mode == 'lscabinets') {
            cabinets.forEach(cabinet => console.log(`${cabinet.Name}: ${cabinet.Id}`));
            return;
        }
    
        const cabinetName = args['c'];
        if (!cabinetName) {
            console.log("-c cabinet name not defined.")
            return;
        }
        
        const matchingCabinets = cabinets.filter(cabinet => cabinet.Name == cabinetName);
        if (matchingCabinets.length == 0) { 
            console.log(`No matching cabinet(s) for "${cabinetName}".`); 
            return; 
        }
        if (cabinetName && matchingCabinets.length > 1) {
            console.log(`WARNING: There are multiple cabinets with the name "${cabinetName}", using the first one.`);
        }
    
        if (mode == 'upload') {
            const readFilePath = args['p'];
    
            if (!readFilePath) { 
                console.log("-p read path not specified."); 
                return; 
            }
    
            const data: any = await DocuwareHelper.uploadDocument(matchingCabinets[0].Id, readFilePath);
    
            const id: number = data.Fields.find((field: any) => field.FieldName == "DWDOCID").Item;
            console.log(`DWDOCID: ${id}`);
    
            const link: string = GLOBALS.endpoint + data.Links.find((link: any) => link.rel == "self").href;
            console.log(`LINK: ${link}`);
            
            console.log("File uploaded");
        } else {
            console.log("Fetching documents...");
            const downloadFunction: string = args['f'];
            const downloadQuery: string = args['q'];
            const specificId: string = args['i'];
            const documents: Array<any> = [];
            if (specificId) {
                documents.push(await DocuwareHelper.getDocument(matchingCabinets[0].Id, specificId));
            } else if (downloadQuery) {
                documents.push(...(await DocuwareHelper.getDocumentsWithQuery(matchingCabinets[0].Id, downloadQuery)));
            } else if (downloadFunction) {
                documents.push(...(await DocuwareHelper.getDocumentsWithFunction(matchingCabinets[0].Id, downloadFunction)));
            } else if (mode != 'update') {
                documents.push(...(await DocuwareHelper.getAllDocumentsFromCabinet(matchingCabinets[0].Id)));
            } else {
                console.log("None of -f -q -i defined."); 
                return; 
            }
            
            console.log("Completed document fetching.");
    
            if (!documents.length) {
                console.log("No matching documents found.");
                return;
            }
    
            switch(mode) {
                case 'get': {
                    console.log(JSON.stringify(documents));
                    break;
                }
                case 'update': {
                    const updateJSONStr = (args['u'] || '').replace(/'/g, '"');
    
                    if (!updateJSONStr) { 
                        console.log("-u update json not defined."); 
                        return; 
                    } 
                    let updateJSON: any = null;
                    try {
                        updateJSON = JSON.parse(updateJSONStr);
                    } catch(ex) {
                        console.log("-u is not valid json (remember to use single quotes).");
                        return;
                    }
    
                    if (documents.length > 1) {
                        console.log("Multiple matching documents found, tighten the fitler function.")
                        return;
                    }
    
                    console.log("Updating document...");
                    const document = documents[0];
                    const documentId = document.id;
                    await DocuwareHelper.updateDocument(matchingCabinets[0].Id, documentId, updateJSON);
                    console.log("Completed document update...");
                    break;
                }
                case 'download': {
                    const fileName = args['n'] || '';
                    const writeFolder = args['p'];
    
                    if (!writeFolder) { 
                        console.log("-p write folder path not specified."); 
                        return; 
                    }
                    if (!fileName) { 
                        console.log("-n file name perfix not specified."); 
                        return; 
                    }
    
                    console.log(`Starting downloads for "${cabinetName}"`);
                    for (let i = 0; i < documents.length; i++) {
                        const document = documents[i];
                        const documentId = document.id;
                        const documentTitle = `${fileName}_${i}.pdf`;
                        const stream = await DocuwareHelper.downloadDocument(matchingCabinets[0].Id, documentId);
                        const writer = fs.createWriteStream(path.join(writeFolder, documentTitle));
                        stream.pipe(writer);
                        await new Promise((resolve) => writer.on('close', resolve))
                        console.log(`File "${documentTitle}" downloaded.`);
                    }
                    console.log(`Downloads completed for "${cabinetName}"`);
                    break;
                }
                default: {
                    console.log(`Mode "${mode}" not supported, use one of upload/update/download.`);
                    break;
                }
            }
        }
    };
}

const nodePath = path.resolve(process.argv[1]);
const modulePath = path.resolve(fileURLToPath(import.meta.url))
const isRunningDirectlyViaCLI = nodePath === modulePath;
if (isRunningDirectlyViaCLI) {
    DocuwareCMD.execute();
}