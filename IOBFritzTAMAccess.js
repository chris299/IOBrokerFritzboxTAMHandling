/*
https://forum.iobroker.net/topic/15533/tr-64-erkennen-ob-ein-aufruf-auf-ab-gesprochen-wurde/6
https://forum.iobroker.net/topic/14288/tr-064-fritzbox-anrufbeantworter/39
Kurzbeschreibung

Mit diesem Skript können die Anrufbeantworterdaten der Anrufer aus der Fritzbox ausgelesen werden. Die Informationen werden in einer JSON Struktur zur Verfügung gestellt.

Vorhande Einträge (Indexnummern) auf dem Anrufbeantworter werden ebenfalls in einer JSON Struktur zur verfügung gestellt werden und einzelne Nachrichten auf dem

Anrufbeantworter können auf Basis der Indexnummer gelöscht werden. 

Einschränkungen:

          - aktuell keine


2020-09-03: Initiale Version um Informationen aus der Fritzbox über die API auszulesen

          https://avm.de/service/schnittstellen/?spm=a2c6h.14275010.0.0.202628cfwq7844
          https://forum.iobroker.net/topic/14288/tr-064-fritzbox-anrufbeantworter/21
          https://developer.aliyun.com/mirror/npm/package/iobroker.tr-064


2020-09-09: Mit der Funktion Fritzbox_Anrufbeantworter_GetMessageList() werden die auf dem Fritzbox hinterlegten Anrufe auf dem Anrufbeantworter ausgelesen. 

          Getestet mit Fritzbox 7530 SW 7.20, Fritzbox 6590 SW 7.20
          getestet mit 7590 SW 8.03


2020-09-12:

          - Konstante NewIndex_Anrufbeantworter eingeführt welche die ID des Anrufbeatworters in der Fritzbox entspricht
          - Mit dem Skript aus https://forum.iobroker.net/topic/15533/tr-64-erkennen-ob-ein-aufruf-auf-ab-gesprochen-wurde/5 wird ermittelt ob der Anrufer
            auf den Anrufbeantworter gesprochen hat und es werden die Daten aus der Fritzbox ausgelesen
          - Datenpunkt (Button) eingefügt um manuell das Auslesen der Daten aus dem Anrufbeantworter zu triggern
          - Im Datenpunkt DP_Fritzbox_AnrufbeantworterDeleteMessage wird der Index der Nachricht auf dem Anrufbeantworter eingetragen welcher gelöscht werden soll

2020-09-13:
          - Im Datenpunkt DP_Fritzbox_AnrufbeantworterIndexMessage_json wird ein JSON String für das Widget "materialdesign - Select" erzeugt, welches die Index Einträge
            der Anrufereinträge auf dem Anrufbeantworter enthält  
2020-09-22:
          - Wenn keine Nachricht auf dem AB vorhanden ist, wird in den Datenpunkt DP_Fritzbox_AnrufbeantworterIndexMessage_json ein Eintrag hinzugefügt,
            dass keine Nachricht vorhanden ist.         

2025-06-23:
         - message download und transkirbierung ergänzt        
         - multi-AB angefangen, siehe auch https://fritz.com/fileadmin/user_upload/Global/Service/Schnittstellen/x_contactSCPD.pdf          

2025-06-25:
        - iob datenpunkt mit temp pfad, damit man das wav weiter senden kann         
*/



const { URL } = require('url'); // eigentlich wohl nur nötig in Node.js vor v10 ?!?

const debug = true;

// für das transkript per Azure Speech services

const transcribe = true;
const sendAudio = false; // muss man in Zeile 410 ff. konfigurieren

const azureKey = "E8wFRib***********************************************YACOGtfFC"; // put your key here...
const azureTranscribeUrl = "https://westeurope.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15";
const TAMexpectedLanguage = "de-DE";  //iso code for expected language for transcription

var FormData = require('form-data');

// für die FRitzbox (DP des iobroker tr64 Adapters für soap Commandos)
const DP_Fritzbox_tr64_Command = "tr-064.0.states.command";
const DP_Fritzbox_tr64_CommandResult = "tr-064.0.states.commandResult";

const DP_Fritzbox_SessionId = "0_userdata.0.Telefon.Fritzbox_SessionId"; //session ID aus authentifizierung des adapters (oder eigenem login)

const Index_Anrufbeantworter = 1; //ID des hier zu verwendenden Anrufbeantworters in der Fritzbox. Der erste Anrufbeantworter hat die ID 0

// noch nicht vollständig flexibilisiert und ggf. für mehrere ABs funktional

const DP_base_Fritzbox_TAM = "0_userdata.0.Telefon.Anrufbeantworter.";



// hier ggf. den oder die aktiven TAM ermitteln und alle DPs anlegen

const DP_Fritzbox_AnrufbeantworterDaten_json = DP_base_Fritzbox_TAM + Index_Anrufbeantworter + ".Fritzbox_AnrufbeantworterDaten_json";
const DP_Fritzbox_AnrufbeantworterDatenAktualisieren = DP_base_Fritzbox_TAM + Index_Anrufbeantworter + ".Fritzbox_AnrufbeantworterDatenAktualisieren";
const DP_Fritzbox_AnrufbeantworterGesamtAnzahlNachrichten = DP_base_Fritzbox_TAM + Index_Anrufbeantworter + ".Fritzbox_AnrufbeantworterGesamtAnzahlNachrichten";
const DP_Fritzbox_AnrufbeantworterAnzahlNeueNachrichten = DP_base_Fritzbox_TAM + Index_Anrufbeantworter + ".Fritzbox_AnrufbeantworterAnzahlNeueNachrichten"
const DP_Fritzbox_AnrufbeantworterDeleteMessage = DP_base_Fritzbox_TAM + Index_Anrufbeantworter + ".Fritzbox_AnrufbeantworterDeleteMessage";
const DP_Fritzbox_AnrufbeantworterIndexMessage_json = DP_base_Fritzbox_TAM + Index_Anrufbeantworter + ".Fritzbox_AnrufbeantworterIndexMessage_json";

const DP_Fritzbox_AnrufbeantworterLatestMessageIndex = DP_base_Fritzbox_TAM + Index_Anrufbeantworter + ".Fritzbox_AnrufbeantworterLatestMessageIndex";
const DP_Fritzbox_AnrufbeantworterLatestMessageData = DP_base_Fritzbox_TAM + Index_Anrufbeantworter + ".Fritzbox_AnrufbeantworterLatestMessageData";
const DP_Fritzbox_AnrufbeantworterLatestMessagePath = DP_base_Fritzbox_TAM + Index_Anrufbeantworter + ".Fritzbox_AnrufbeantworterLatestMessagePath";
const DP_Fritzbox_AnrufbeantworterLatestMessageLocalPath = DP_base_Fritzbox_TAM + Index_Anrufbeantworter + ".Fritzbox_AnrufbeantworterLatestMessageLocalPath";
const DP_Fritzbox_AnrufbeantworterLatestMessageTranskript = DP_base_Fritzbox_TAM + Index_Anrufbeantworter + ".Fritzbox_AnrufbeantworterLatestMessageTranskript";




ensureStateExists(DP_Fritzbox_AnrufbeantworterDaten_json, '{}', { name: 'JSON Struktur mit den Daten vom Anrufbeantworter aus der FritzBox', unit: '', type: 'string', role: 'value', def: '{}' });
ensureStateExists(DP_Fritzbox_AnrufbeantworterDatenAktualisieren, false, { name: 'Manueller Trigger um die Daten aus dem Anrufbeantworter auszulesen', unit: '', read: true, write: true, type: 'boolean', role: 'button', def: false });
ensureStateExists(DP_Fritzbox_AnrufbeantworterGesamtAnzahlNachrichten, 0, { name: 'Gesamtanzahl der Nachrichten auf dem Anrufbeantworter', unit: '', type: 'number', role: 'value', def: 0 });
ensureStateExists(DP_Fritzbox_AnrufbeantworterAnzahlNeueNachrichten, 0, { name: 'Anzahl der neuen Nachrichten auf dem Anrufbeantworter', unit: '', type: 'number', role: 'value', def: 0 });
ensureStateExists(DP_Fritzbox_AnrufbeantworterDeleteMessage, '', { name: 'Zum loeschen ausgewaehlter Eintrag vom Anrufbeantworter', unit: '', read: true, write: true, type: 'string', role: 'value', def: '' });
ensureStateExists(DP_Fritzbox_AnrufbeantworterIndexMessage_json, '', { name: 'JSON Struktur mit den Anrufbeantworter Index Eintraegen um sie in einem Select Widget darstellen zu koennen', unit: '', read: true, write: true, type: 'string', role: 'value', def: '' });


ensureStateExists(DP_Fritzbox_AnrufbeantworterLatestMessageIndex, 0, { name: 'Index Nummer der letzten Anrufbeantworter Nachricht', unit: '', read: true, write: true, type: 'number', role: 'value', def: 0 });
ensureStateExists(DP_Fritzbox_AnrufbeantworterLatestMessageData, "{}", { name: 'Metadaten der letzten Anrufbeantworter Nachricht', unit: '', read: true, write: true, type: 'string', role: 'value', def: '{}' });
ensureStateExists(DP_Fritzbox_AnrufbeantworterLatestMessagePath, "", { name: 'Pfad auf der Fritzbox zur letzten Anrufbeantworter Nachricht', unit: '', read: true, write: true, type: 'string', role: 'value', def: '' });
ensureStateExists(DP_Fritzbox_AnrufbeantworterLatestMessageLocalPath, "", { name: 'Lokaler Pfad zur WAV-Datei der runtergeladenen Nachricht', unit: '', read: true, write: true, type: 'string', role: 'value', def: '' });
ensureStateExists(DP_Fritzbox_AnrufbeantworterLatestMessageTranskript, "", { name: 'Transkript zur letzten Anrufbeantworter Nachricht auf der Fritzbox', unit: '', read: true, write: true, type: 'string', role: 'value', def: '' });

if (!transcribe) { setState(DP_Fritzbox_AnrufbeantworterLatestMessageTranskript, "Transkript deaktiviert"); }

ensureStateExists(DP_Fritzbox_SessionId, 0, { name: 'SessionId für den auhtentifizierten Zugriff auf die Fritzbox', unit: '', read: true, write: true, type: 'string', role: 'value', def: '' });


// ==== States checken und ggf. anlegen====
async function ensureStateExists(id, initialValue, common) {
    try {
        const exists = await existsState(id);
        if (!exists) {
            await createStateAsync(id, initialValue, false, common);
            if (debug) { console.log("created state: " + id); }
        }

    } catch (e) {
        console.log(`Fehler bei Set State ${id} = ${initialValue} : ${e.message}`);
        //console.log(e);
    }
}


//Funktion Fritzbox_Anrufbeantworter_DeleteMessage() löscht die Nachricht welche als Index übergeben wird und liest danach erneut alle Anrufe vom Anrufbeantworter wieder aus

function Fritzbox_Anrufbeantworter_DeleteMessage(NewMessageIndex) {

    var befehl_DeleteMessage = '{"service": "urn:dslforum-org:service:X_AVM-DE_TAM:1","action": "DeleteMessage","params": {"NewIndex": "' + Index_Anrufbeantworter + '", "NewMessageIndex": "' + NewMessageIndex + '" }}';
    if (debug) { console.log("Soap Comand : " + befehl_DeleteMessage); }
    setState(DP_Fritzbox_tr64_Command, "{}"); // alt, evtl. streichen
    setState(DP_Fritzbox_tr64_Command, befehl_DeleteMessage); //Befehl zum loeschen einer Nachricht im Anrufbeantworter
    if (debug) console.log("Antwort auf command im State tr-064.0.states.commandResult: " + getState(DP_Fritzbox_tr64_CommandResult).val);

    Fritzbox_Anrufbeantworter_GetMessageList(Index_Anrufbeantworter);
}

on({ id: DP_Fritzbox_AnrufbeantworterDeleteMessage, change: 'any' }, function (obj) {

    if (debug) console.log("Es wird der Eintrag auf dem Anrufebeantworter mit dem Index: " + getState(DP_Fritzbox_AnrufbeantworterDeleteMessage).val + "gelöscht");

    Fritzbox_Anrufbeantworter_DeleteMessage(getState(DP_Fritzbox_AnrufbeantworterDeleteMessage).val);

});


var AB_Index_DeleteMessageIndex = {};

AB_Index_DeleteMessageIndex.sendTo = function (text, subText = '', value = '', icon = '', iconColor = '') {

    let json = getState(DP_Fritzbox_AnrufbeantworterIndexMessage_json).val;



    if (json) {

        try {



            json = JSON.parse(json);



        } catch (e) {

            json = [];

            //          console.warn('Wert ist kein JSON string! Wert wird ersetzt!');

        }

    } else {

        json = [];

    }



    json.push(
        {
            text: text,
            subText: subText,
            value: value,
            icon: icon,
            iconColor: iconColor,
        }
    )

    setState(DP_Fritzbox_AnrufbeantworterIndexMessage_json, JSON.stringify(json), true);

}

/*
Funktion Fritzbox_Anrufbeantworter_GetMessageList() liest aus der Fritzbox die hinterlegten Informationen zu den Anrufen auf dem 
Anrufbeantworter via iobroker adapter (soap protokoll) aus. Ergebnis als JSON in einen Datenpunkt gespeichert, damit es in VIS einfach dargestellt werden kann. Es werden
in Datenpunkten gespeichert  wieviele Anrufe im Anrufbeantworter insgesamt vorliegen und wieviele neue Nachrichten vorhanden sind
*/

async function Fritzbox_Anrufbeantworter_GetMessageList(tam_index) {
    //Skript zum parsen von XML zu JSON: https://forum.iobroker.net/topic/623/gel%C3%B6st-xml-daten-einer-url-weiterverarbeiten/19
    //Damit das xml geparsed werden kann muss in der Javascript Instanz unter "Zusätzliche NPM Module" noch "xml2js" (mit Enter bestätigen) eintragen werden

    const parseString = require('xml2js').parseString;

    var Fritzbox_AnrufbeantworterAnzahlNeueNachrichtenn = 0;

    var Fritzbox_AnrufbeantworterDaten_json = "";

    /*
{
  "service": "urn:dslforum-org:service:X_AVM-DE_TAM:1",
  "action": "GetList",
  "params": {}
}

gibt alle AB infos

{"NewTAMList":"<List><TAMRunning>1</TAMRunning><Stick>2</Stick><Status>0</Status><Capacity>733</Capacity><Item><Index>0</Index><Display>1</Display><Enable>0</Enable><Name>Anrufbeantworter 1</Name></Item><Item><Index>1</Index><Display>1</Display><Enable>1</Enable><Name>Anrufbeantworter w</Name></Item><Item><Index>2</Index><Display>0</Display><Enable>0</Enable><Name></Name></Item><Item><Index>3</Index><Display>0</Display><Enable>0</Enable><Name></Name></Item><Item><Index>4</Index><Display>0</Display><Enable>0</Enable><Name></Name></Item></List>\n"}

damit muss man ggf. multiple ABs einrichten (in <Item>)

    */

    const SoapCommand = '{"service": "urn:dslforum-org:service:X_AVM-DE_TAM:1","action": "GetMessageList","params": {"NewIndex ": "' + String(tam_index) + '"}}';
    if (debug) { console.log("Soap Comand : " + SoapCommand); }

    // setState("tr-064.0.states.command", "{}"); // wozu ist das gut? braucht man m.e. nicht. (übernommen aus frührer Version)
    await setStateAsync(DP_Fritzbox_tr64_Command, SoapCommand); //Befehl zum auslesen der Anrufbeantworterdaten in Datenpunkt schreiben


    await setStateAsync(DP_Fritzbox_AnrufbeantworterIndexMessage_json, "");  //Setzt den aktuellen Inhalt vom Datenpunkt zurück, damit im Verlauf die Index Nummer von den Anrufen neu geschrieben werden können


    //Das Ergebnis im Datenpunkt commandResult ist ein Link auf ein XML welches die Informationen zu den Anrufen auf dem
    //Anrufbeantworter enthält. Das Ergebnis hat folgendes Format: {"NewURL":"http://192.168.178.1:49000/tamcalllist.lua?sid=2a4abe5e5ad61b64&tamindex=0"}
    //Aus diesem String wird mittels substring der eigentliche Link (url) extrahiert


    await wait(500);
    // manchmal kommt anscheinend erstmal ein error 500 (interner server error) von der Fritzbox zurück. muss man nochmal beobachten
    // evtl. muss man hier auch einfach etwas warten.... 100-200 ms sollten das schon sein

    const SoapResponse = await getStateAsync(DP_Fritzbox_tr64_CommandResult);
    if (debug) console.log("Antwort auf command im State tr-064.0.states.commandResult: " + SoapResponse.val);
    if (SoapResponse.val === '{"code":500}') { log("soap command returned 500", "error"); return; } //abbruch bei result code 500



    //const Result_Fritzbox_HyperlinkXmlTAM = SoapResponse.substring(11, getState("tr-064.0.states.commandResult").val.length - 2);  //die reine URL wird extrahiert


    // alternative URL und sid extarktion:

    //const befehl_result = getState("tr-064.0.states.commandResult").val;

    // if (debug) { console.log("Antwort auf command im State tr-064.0.states.commandResult: " + befehl_result); }
    //anscheinend typeofval === string, wäre ggf. nochmal abzusichern.
    // JSON in Objekt umwandeln
    const parsedResult = JSON.parse(SoapResponse.val);

    // URL extrahieren

    if (debug) { console.log("path from commandResult: " + parsedResult.NewURL); }

    // URL-Objekt erzeugen
    const fullCalllistUrl = new URL(parsedResult.NewURL);

    // Parameter tam index und sid extrahieren
    const sid = fullCalllistUrl.searchParams.get("sid");
    setState(DP_Fritzbox_SessionId, sid);


    const tamindex = fullCalllistUrl.searchParams.get("tamindex");

    if (debug) { console.log("sid : " + sid + " ; tamindex : " + tamindex); }

    // if (debug) console.log("Extrahierter Hyperlink aus commandresult. CommandResult: " + getState("tr-064.0.states.commandResult").val + " und der extrahierte Link: " + Result_Fritzbox_HyperlinkXmlTAM);


    //Das XML File wird abgeholt, geparst und in eine JSON Struktur umgewandelt       

    httpGet(parsedResult.NewURL, function (error, response) {  // müsste man eigentlich auch per POST machen... geht aber anscheinend auch so

        if (!error && response.statusCode == 200) {

            //         const body = response.data;
            //     if(debug) console.log("Body: " + body);


            //Aus dem xml String wird der Wert nach tam calls: extrahiert welcher die Anzahl der Anrufe auf dem Anrufbeantworter angibt
            //Beispiel: ... <!-- tam calls:0 --> </Root> ...
            //https://regex101.com/
            //https://regex101.com/r/Q74grJ/1

            const regex = /<!-- tam calls:[\s\S]*?(\d+)/igm;
            const matches = regex.exec(response.data);
            const FB_xml_TamCalls = parseInt(matches[1]);



            if (debug) console.log("FB_xml_TamCalls aus XML extrahiert: " + FB_xml_TamCalls);

            setState(DP_Fritzbox_AnrufbeantworterGesamtAnzahlNachrichten, FB_xml_TamCalls);





            parseString(response.data, {
                explicitArray: true, // Always put child nodes in an array if true; otherwise an array is created only if there is more than one.
                mergeAttrs: true //Merge attributes and child elements as properties of the parent, instead of keying attributes off a child attribute object. This option is ignored if ignoreAttrs is true.
            },
                function (err, result) {
                    if (err) {
                        log("Fehler: " + err);
                    }
                    else {
                        if (debug) console.log("Ergebnis Umwandlung CallList XML in JSON: " + JSON.stringify(result));

                        //Abhaengig von der Anzahl der Anruf auf dem Anrufbeantworter erfolgt die weitere Verarbeitung der Daten

                        if (FB_xml_TamCalls == 0) {       //Wenn keine Nachrichten auf dem Anrufbeantworter in der Fritzbox vorliegen

                            //JSON String aus der Fritzbox wenn keine Nachricht auf dem AB ist
                            //JSON: {"Root":"\n\n\n\n"}
                            Fritzbox_AnrufbeantworterDaten_json = '[{"Index":["---"],"Tam":["---"],"Called":["---"],"Date":["---"],"Duration":["---"],"Inbook":["---"],"Name":["---"],"New":["---"],"Number":["---"],"Path":["---"]}]';
                            setState(DP_Fritzbox_AnrufbeantworterAnzahlNeueNachrichten, 0); //Anzahl der neuen Nachrichten auf 0 setzen
                            setState(DP_Fritzbox_AnrufbeantworterDaten_json, Fritzbox_AnrufbeantworterDaten_json);

                            setTimeout(function () {

                                AB_Index_DeleteMessageIndex.sendTo("Keine Nachricht vorhanden", "", "", "phone-message-outline", "red");

                            }, 500);

                        }
                        else {                           //Mindestens eine Nachricht ist auf dem Anrufbeantworter in der Fritzbox vorhanden

                            //JSON String wenn eine Nachricht auf dem Anrufbeantworter ist
                            //JSON: {"Root":{"Message":[{"Index":["0"],"Tam":["0"],"Called":["0123456789"],"Date":["09.09.20 21:17"],"Duration":["0:01"],"Inbook":["0"],"Name":["Feuersturm"],"New":["1"],"Number":["0987654321"],"Path":["/download.lua?path=/data/tam/rec/rec.0.000"]}]}}
                            //JSON String wenn zwei Nachrichten auf dem Anrufbeantworter sind
                            //JSON: {"Root":{"Message":[{"Index":["1"],"Tam":["0"],"Called":["0123456789"],"Date":["09.09.20 21:30"],"Duration":["0:01"],"Inbook":["0"],"Name":["Feuersturm"],"New":["1"],"Number":["0987654321"],"Path":["/download.lua?path=/data/tam/rec/rec.0.001"]},{"Index":["0"],"Tam":["0"],"Called":["0123456789"],"Date":["09.09.20 21:17"],"Duration":["0:01"],"Inbook":["0"],"Name":["Feuersturm"],"New":["0"],"Number":["0987654321"],"Path":["/download.lua?path=/data/tam/rec/rec.0.000"]}]}}

                            Fritzbox_AnrufbeantworterDaten_json = JSON.stringify(result);
                            const TAMCalllist_JSON = result;
                            if (debug) { console.log("TAMCalllist_JSON: " + JSON.stringify(TAMCalllist_JSON)); }

                            Fritzbox_AnrufbeantworterDaten_json = Fritzbox_AnrufbeantworterDaten_json.substring(19, JSON.stringify(result).length - 2); // ziemlich wüste JSON modification
                            setState(DP_Fritzbox_AnrufbeantworterDaten_json, Fritzbox_AnrufbeantworterDaten_json);

                            // latest message extrahieren

                            // meta daten latest message setzen
                            const latestMessageIndex = getNewestMessageIndexByDate(TAMCalllist_JSON);
                            if (debug) { console.log("Index der neuesten Message (nach Datum):" + latestMessageIndex); }
                            setState(DP_Fritzbox_AnrufbeantworterLatestMessageIndex, latestMessageIndex);

                            const latestMessageData = TAMCalllist_JSON.Root.Message.find(msg => msg.Index[0] === String(latestMessageIndex)); // [0] weil immer alles arrays sind und der index mit ""
                            if (debug) { console.log("neuesten Message (nach Datum):" + JSON.stringify(latestMessageData)); }

                            // array definiton für die message data entfernen, da überflüssig
                            const flattened = Object.fromEntries(
                                Object.entries(latestMessageData).map(([key, value]) => [key, value[0]]));
                            if (debug) { console.log("no arrays anymore: " + JSON.stringify(flattened)); }
                            setState(DP_Fritzbox_AnrufbeantworterLatestMessageData, JSON.stringify(flattened));

                            const latestMessagePath = "http://" + fullCalllistUrl.host + latestMessageData.Path[0];
                            setState(DP_Fritzbox_AnrufbeantworterLatestMessagePath, latestMessagePath);
                            if (debug) { console.log("Pfad zur neusten Message):" + latestMessagePath); }


                            // wav datei abholen und in ein tempFile schreiben

                            const POSTData = `sid=${encodeURIComponent(sid)}`;
                            if (debug) { console.log("wav download : " + latestMessagePath + "  ; post data : " + POSTData); }

                            httpPost(latestMessagePath,
                                POSTData,
                                {
                                    timeout: 10000,
                                    responseType: 'arraybuffer',
                                    validateCertificate: false,
                                    headers: {
                                        'User-Agent': 'iobroker Javascript)',
                                        'Accept': '*/*',
                                        'Cache-Control': 'no-cache',
                                        'Connection': 'keep-alive',
                                        'Content-Type': 'application/x-www-form-urlencoded'
                                    },
                                },
                                function async(error, response) {
                                    if (error) {
                                        log("Fehler beim Message-Download: " + error, "error");
                                        return;
                                    } else {
                                        // hier noch check , ob da wirklich eine wav datei zurück gekommen ist...
                                        const byteArray = new Uint8Array(response.data);
                                        if (!isValidWav(byteArray)) {log("maybe not valid WAV", "warn");} else { if (debug) {log("Wav format test success");} }
                                        // als datei temporär abspeichern
                                        const tempFilePath = createTempFile('message.wav', response.data);
                                        // temp pfad im iobroker verfügbar machen
                                        setState(DP_Fritzbox_AnrufbeantworterLatestMessageLocalPath,tempFilePath);

                                        //if (debug) { console.log(response.data); }
                                        if (debug) {
                                            console.log("response header:" + response.headers)
                                            console.log(`Saved to ${tempFilePath}`);
                                        }

                                        // Use the new path in other scripts (e.g. sendTo)
                                        if (sendAudio) {
                                            sendTo('email.1', 'send', {
                                                text: 'Neue AB Nachricht im Anhang', to: 'test@test.de', subject: 'Neue AB Nachricht',
                                                attachments: [{ path: tempFilePath, cid: 'message.wav' },],
                                            }
                                            );
                                        };

                                        // temp file transkribieren wenn entsprechend konfiguriert

                                        if (transcribe) {

                                            var axios = require('axios');
                                            var fs = require('node:fs');
                                            var data = new FormData();

                                            data.append('definitions', '{"locales":["' + TAMexpectedLanguage + '"], "profanityFilterMode":"None"}');
                                            data.append('audio', fs.createReadStream(tempFilePath));

                                            if (debug) {
                                                console.log("post form data für azure transcribe:")
                                                console.log(data);
                                            }

                                            var config = {
                                                method: 'post',
                                                url: azureTranscribeUrl,
                                                headers: {
                                                    'Ocp-Apim-Subscription-Key': azureKey,
                                                    'User-Agent': 'iobroker Javascript',
                                                    'Content-Type': 'multipart/form-data',
                                                    'Accept': '*/*',
                                                    'Connection': 'keep-alive',
                                                    ...data.getHeaders()
                                                },
                                                data: data
                                            };


                                            axios(config)
                                                .then(function (response) {
                                                    if (debug) {
                                                        console.log(JSON.stringify(response.data));
                                                        console.log(JSON.stringify("Transkript : " + response.data.combinedPhrases?.[0]?.text));
                                                    }
                                                    if (response.data.combinedPhrases?.[0]?.text==="") {
                                                        setState(DP_Fritzbox_AnrufbeantworterLatestMessageTranskript, "Transkript leer");
                                                    } else {
                                                        setState(DP_Fritzbox_AnrufbeantworterLatestMessageTranskript, (response.data.combinedPhrases?.[0]?.text || "undefiniert"));
                                                    }
                                                })
                                                .catch(function (error) {
                                                    log(error, "error");
                                                    log(JSON.stringify(response.data), "error");
                                                    setState(DP_Fritzbox_AnrufbeantworterLatestMessageTranskript, "Transkription fehlgeschlagen");
                                                });

                                        }
                                    }
                                }
                            );







                            if (debug) console.log("result.Root.Message.length: " + JSON.stringify(result.Root.Message.length));

                            for (let i = 0; i < JSON.stringify(result.Root.Message.length); i++) {  // scheleife über alle message einträge
                                let MessageIndexValue = JSON.stringify(result.Root.Message[i].Index);
                                MessageIndexValue = MessageIndexValue.substring(2, MessageIndexValue.length - 2);  // eckige klammer und anführungszeichen entfernen
                                if (debug) console.log("Nachricht neu [i]: [" + i + "]" + JSON.stringify(result.Root.Message[i].New) + " mit Index: " + JSON.stringify(result.Root.Message[i].Index) + " und gekürzt: " + MessageIndexValue);
                                setTimeout(function () {
                                    AB_Index_DeleteMessageIndex.sendTo("AB Index", "", MessageIndexValue, "phone-message-outline", "red");
                                }, i * 500);

                                if (JSON.stringify(result.Root.Message[i].New) === '["1"]') {
                                    Fritzbox_AnrufbeantworterAnzahlNeueNachrichtenn = Fritzbox_AnrufbeantworterAnzahlNeueNachrichtenn + 1;
                                }

                            }

                            if (debug) console.log("Anzahl Neuer Nachrichten auf dem AB: " + Fritzbox_AnrufbeantworterAnzahlNeueNachrichtenn);

                            setState(DP_Fritzbox_AnrufbeantworterAnzahlNeueNachrichten, Fritzbox_AnrufbeantworterAnzahlNeueNachrichtenn);
                        }
                    }
                });
        }
        else {
            console.log(error);
        }
    });
}


//Über Datenpunkt kann manuell das Auslesen der Daten aus dem Anrufbeantworter getriggert werden

on({ id: DP_Fritzbox_AnrufbeantworterDatenAktualisieren, change: 'any' }, function (obj) {
    Fritzbox_Anrufbeantworter_GetMessageList(Index_Anrufbeantworter);
});


// Helper für neueste Message basierend auf Datum
function getNewestMessageIndexByDate(data) {
    const messages = data.Root.Message;
    let newestMessage = null;
    let newestDate = null;

    messages.forEach(msg => {
        // Datum parsen (Format: "08.06.25 19:02")
        const dateStr = msg.Date[0];
        const [datePart, timePart] = dateStr.split(' ');
        const [day, month, year] = datePart.split('.');
        const [hour, minute] = timePart.split(':');

        // Vollständiges Jahr (25 -> 2025)
        const fullYear = parseInt('20' + year);
        const date = new Date(fullYear, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));

        if (!newestDate || date > newestDate) {
            newestDate = date;
            newestMessage = msg;
        }
    });

    return newestMessage ? parseInt(newestMessage.Index[0]) : null;
}

// Helper für WAV prüfung, gibt Boolean zurück
function isValidWav(wavBytes) {
    // Prüfe Länge für Header
    if (!(wavBytes instanceof Uint8Array) || wavBytes.length < 44) return false;

    // Hilfsfunktion zum Lesen eines ASCII-Strings
    function readAscii(offset, length) {
        return String.fromCharCode(...wavBytes.slice(offset, offset + length));
    }

    const riff = readAscii(0, 4);
    const wave = readAscii(8, 4);
    const fmt = readAscii(12, 4);
    const dataChunkOffset = wavBytes.findIndex((_, i) =>
        readAscii(i, 4) === "data"
    );

    return (
        riff === "RIFF" &&
        wave === "WAVE" &&
        fmt === "fmt " &&
        dataChunkOffset !== -1
    );
}

// test wav file, Kann direkt mit new Blob([wavData.buffer], {type: "audio/wav"}) verwendet werden.
const TestWavData = new Uint8Array([
  82, 73, 70, 70, 116, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32, 16, 0, 0, 0, 1, 0, 1, 0, 64, 31, 0, 0, 64, 31, 0, 0,
  1, 0, 8, 0, 100, 97, 116, 97, 80, 0, 0, 0, 128, 171, 208, 237, 252, 253, 239, 211, 174, 131, 88, 50, 20, 4, 2, 14, 41,
  77, 120, 163, 202, 233, 251, 254, 242, 217, 182, 139, 96, 56, 25, 6, 1, 11, 35, 70, 112, 155, 196, 228, 248, 254, 246,
  223, 189, 147, 104, 63, 30, 8, 1, 8, 30, 63, 104, 147, 189, 223, 246, 254, 248, 228, 196, 155, 112, 70, 35, 11
]);


//------------------------- Anrufername oder Telefonnummer ermitteln -----------
//Quelle: https://forum.iobroker.net/topic/15533/tr-64-erkennen-ob-ein-aufruf-auf-ab-gesprochen-wurde/5
/*
Steht der Anrufer in Adressbuch wird Vorname und Name ausgegeben, sonst die 
Telefonnummer
*/


function telefonname() {
    var tokens = getState("tr-064.0.callmonitor.inbound.callerName").val.split(",");
    var answer = '';
    var vorname = tokens[1];
    var famname = tokens[0];

    if (famname === undefined) famname = '';
    if (vorname === undefined) vorname = '';
    if (vorname !== '' || famname !== '')
        answer = vorname + ' ' + famname;
    else
        answer = getState("tr-064.0.callmonitor.inbound.caller").val;
    return answer;
}

/*
---------------------------- Anruf beendet -------------------------------------
Quelle: https://forum.iobroker.net/topic/15533/tr-64-erkennen-ob-ein-aufruf-auf-ab-gesprochen-wurde/5
Es werden die Anzahl der Anrufe auf Anrufbeantworter und eine Liste von 
Namen mitgeführt, die Nachrichten hinterlassen haben.
Es werden dazu 'callmonitor.lastCall.type' und 
'tr-064.0.callmonitor.lastCall.extension' ausgewertet.

Mangels Dok wurde durch Ausprobieren ermittelt, dass
- type === missed                        : es wurde aufgelegt und nicht gesprochen.
- type === disconnect && extension !== 40: Gespräch wurde geführt und dann aufgelegt
- type === disconnect && extension === 40: Nachricht auf AB 0
bedeuten könnte

extension scheint die scheint der port des calls zu sein ( eine etwas unglpckliche übersetzung)
gem.  https://fritz.com/fileadmin/user_upload/Global/Service/Schnittstellen/x_contactSCPD.pdf
"5.2 Call List Content
The following shows an example XML content for a call list.
To differ between voice calls, fax calls and TAM calls use the Port value.
E.g. if port equals 5 it is a fax call. If port equals 6 or port in in the rage of 40 to 49 it is a
TAM call."

*/


on({ id: "tr-064.0.callmonitor.toPauseState", change: 'ne' }, function (obj) {
    setTimeout(function () {
        if (getState('tr-064.0.callmonitor.toPauseState').val === 'end') { //aktueller Call gerade zuende
            var name = telefonname(); //name oder nummer rausfinden
            if (getState("tr-064.0.callmonitor.lastCall.type").val === 'missed') {
                if (debug) { console.log(name + " hat aufgelegt und keine Nachricht hinterlassen"); }
            }

            if (getState("tr-064.0.callmonitor.lastCall.type").val === 'disconnect') {
                //40 - 49 AB nachricht
                const callPort = getState('tr-064.0.callmonitor.lastCall.extension').val;
                const TAMIndex = callPort - 40;
                if (callPort >= 40 && callPort <= 49) {
                    if (debug) {
                        console.log(name + " hat auf den Anrufbeantworter " + TAMIndex + " gesprochen. Daten werden aus der Fritzbox ausgelesen...");
                    }
                    //Es werden nun die Informationen aus dem Anrufbeantworter in der Fritzbox ausgelesen
                    Fritzbox_Anrufbeantworter_GetMessageList(TAMIndex);
                } else {
                    if (debug) {
                        console.log("Der Anruf von " + name + " hat " + getState("tr-064.0.callmonitor.lastCall.duration").val + " sec gedauert");  // falscher name bei outbound...
                        console.log("lastCall.extension : " + getState('tr-064.0.callmonitor.lastCall.extension').val);
                    }
                }
            }
        }
    }, 3000);
});
