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
         - transkirbierung ergänzt                  
*/



const { URL } = require('url'); // eigentlich wohl nur nötig in Node.js vor v10 ?!?

const debug = true;

// für das transkript per Azure Speech services

const transcribe = true;

const azureKey = "E8....tfFC";
const azureTranscribeUrl = "https://westeurope.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15";
var FormData = require('form-data');

// für die FRitzbox
const DP_Fritzbox_tr64_Command = "tr-064.0.states.command";
const DP_Fritzbox_tr64_CommandResult = "tr-064.0.states.command";


const NewIndex_Anrufbeantworter = 1; //ID des Anrufbeantworters in der Fritzbox. Der erste Anrufbeantworter hat die ID 0

const DP_Fritzbox_AnrufbeantworterDaten_json = "0_userdata.0.Telefon.Anrufbeantworter.Fritzbox_AnrufbeantworterDaten_json";
const DP_Fritzbox_AnrufbeantworterDatenAktualisieren = "0_userdata.0.Telefon.Anrufbeantworter.Fritzbox_AnrufbeantworterDatenAktualisieren";
const DP_Fritzbox_AnrufbeantworterGesamtAnzahlNachrichten = "0_userdata.0.Telefon.Anrufbeantworter.Fritzbox_AnrufbeantworterGesamtAnzahlNachrichten";
const DP_Fritzbox_AnrufbeantworterAnzahlNeueNachrichten = "0_userdata.0.Telefon.Anrufbeantworter.Fritzbox_AnrufbeantworterAnzahlNeueNachrichten"
const DP_Fritzbox_AnrufbeantworterDeleteMessage = "0_userdata.0.Telefon.Anrufbeantworter.Fritzbox_AnrufbeantworterDeleteMessage";
const DP_Fritzbox_AnrufbeantworterIndexMessage_json = "0_userdata.0.Telefon.Anrufbeantworter.Fritzbox_AnrufbeantworterIndexMessage_json";

const DP_Fritzbox_AnrufbeantworterLatestMessageIndex = "0_userdata.0.Telefon.Anrufbeantworter.Fritzbox_AnrufbeantworterLatestMessageIndex";
const DP_Fritzbox_AnrufbeantworterLatestMessageData = "0_userdata.0.Telefon.Anrufbeantworter.Fritzbox_AnrufbeantworterLatestMessageData";
const DP_Fritzbox_AnrufbeantworterLatestMessagePath = "0_userdata.0.Telefon.Anrufbeantworter.Fritzbox_AnrufbeantworterLatestMessagePath";
const DP_Fritzbox_AnrufbeantworterLatestMessageTranskript = "0_userdata.0.Telefon.Anrufbeantworter.Fritzbox_AnrufbeantworterLatestMessageTranskript";

const DP_Fritzbox_SessionId = "0_userdata.0.Telefon.Anrufbeantworter.Fritzbox_SessionId";


ensureStateExists(DP_Fritzbox_AnrufbeantworterDaten_json, '{}', { name: 'JSON Struktur mit den Daten vom Anrufbeantworter aus der FritzBox', unit: '', type: 'string', role: 'value', def: '{}' });
ensureStateExists(DP_Fritzbox_AnrufbeantworterDatenAktualisieren, false, { name: 'Manueller Trigger um die Daten aus dem Anrufbeantworter auszulesen', unit: '', read: true, write: true, type: 'boolean', role: 'button', def: false });
ensureStateExists(DP_Fritzbox_AnrufbeantworterGesamtAnzahlNachrichten, 0, { name: 'Gesamtanzahl der Nachrichten auf dem Anrufbeantworter', unit: '', type: 'number', role: 'value', def: 0 });
ensureStateExists(DP_Fritzbox_AnrufbeantworterAnzahlNeueNachrichten, 0, { name: 'Anzahl der neuen Nachrichten auf dem Anrufbeantworter', unit: '', type: 'number', role: 'value', def: 0 });
ensureStateExists(DP_Fritzbox_AnrufbeantworterDeleteMessage, '', { name: 'Zum loeschen ausgewaehlter Eintrag vom Anrufbeantworter', unit: '', read: true, write: true, type: 'string', role: 'value', def: '' });
ensureStateExists(DP_Fritzbox_AnrufbeantworterIndexMessage_json, '', { name: 'JSON Struktur mit den Anrufbeantworter Index Eintraegen um sie in einem Select Widget darstellen zu koennen', unit: '', read: true, write: true, type: 'string', role: 'value', def: '' });


ensureStateExists(DP_Fritzbox_AnrufbeantworterLatestMessageIndex, 0, { name: 'Index Nummer der letzten Anrufbeantworter Nachricht', unit: '', read: true, write: true, type: 'number', role: 'value', def: 0 });
ensureStateExists(DP_Fritzbox_AnrufbeantworterLatestMessageData, "{}", { name: 'Metadaten der letzten Anrufbeantworter Nachricht', unit: '', read: true, write: true, type: 'string', role: 'value', def: '{}' });
ensureStateExists(DP_Fritzbox_AnrufbeantworterLatestMessagePath, "", { name: 'Pfad auf der Fritzbox zur letzten Anrufbeantworter Nachricht', unit: '', read: true, write: true, type: 'string', role: 'value', def: '' });
ensureStateExists(DP_Fritzbox_AnrufbeantworterLatestMessageTranskript, "", { name: 'Transkript zur letzten Anrufbeantworter Nachricht auf der Fritzbox', unit: '', read: true, write: true, type: 'string', role: 'value', def: '' });

ensureStateExists(DP_Fritzbox_SessionId, 0, { name: 'SessionId für den Zugriff auf die Fritzbox', unit: '', read: true, write: true, type: 'string', role: 'value', def: '' });


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

    var befehl_DeleteMessage = '{"service": "urn:dslforum-org:service:X_AVM-DE_TAM:1","action": "DeleteMessage","params": {"NewIndex": "' + NewIndex_Anrufbeantworter + '", "NewMessageIndex": "' + NewMessageIndex + '" }}';
    if (debug) { console.log("Soap Comand : " + befehl_DeleteMessage); }
    setState("tr-064.0.states.command", "{}");
    setState("tr-064.0.states.command", befehl_DeleteMessage); //Befehl zum loeschen einer Nachricht im Anrufbeantworter
    if (debug) console.log("Antwort auf command im State tr-064.0.states.commandResult: " + getState("tr-064.0.states.commandResult").val);

    Fritzbox_Anrufbeantworter_GetMessageList();
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

function Fritzbox_Anrufbeantworter_GetMessageList() {
    //Skript zum parsen von XML zu JSON: https://forum.iobroker.net/topic/623/gel%C3%B6st-xml-daten-einer-url-weiterverarbeiten/19
    //Damit das xml geparsed werden kann muss in der Javascript Instanz unter "Zusätzliche NPM Module" noch "xml2js" (mit Enter bestätigen) eintragen werden

    const parseString = require('xml2js').parseString;

    var Result_Fritzbox_HyperlinkXmlTAM;

    var Fritzbox_AnrufbeantworterAnzahlNeueNachrichtenn = 0;

    var Fritzbox_AnrufbeantworterDaten_json = "";

    const befehl_GetMessageList = '{"service": "urn:dslforum-org:service:X_AVM-DE_TAM:1","action": "GetMessageList","params": {"NewIndex ": "' + NewIndex_Anrufbeantworter + '"}}';
    if (debug) { console.log("Soap Comand : " + befehl_GetMessageList); }

    setState("tr-064.0.states.command", "{}"); // wozu ist das gut? braucht man m.e. nicht. (übernommen aus frührer Version)
    setState("tr-064.0.states.command", befehl_GetMessageList); //Befehl zum auslesen der Anrufbeantworterdaten in Datenpunkt schreiben

    if (debug) console.log("Antwort auf command im State tr-064.0.states.commandResult: " + getState("tr-064.0.states.commandResult").val);

    setState(DP_Fritzbox_AnrufbeantworterIndexMessage_json, "");  //Setzt den aktuellen Inhalt vom Datenpunkt zurück, damit im Verlauf die Index Nummer von den Anrufen neu geschrieben werden können


    //Das Ergebnis im Datenpunkt commandResult ist ein Link auf ein XML welches die Informationen zu den Anrufen auf dem
    //Anrufbeantworter enthält. Das Ergebnis hat folgendes Format: {"NewURL":"http://192.168.178.1:49000/tamcalllist.lua?sid=2a4abe5e5ad61b64&tamindex=0"}
    //Aus diesem String wird mittels substring der eigentliche Link (url) extrahiert

    Result_Fritzbox_HyperlinkXmlTAM = getState("tr-064.0.states.commandResult").val;
    Result_Fritzbox_HyperlinkXmlTAM = Result_Fritzbox_HyperlinkXmlTAM.substring(11, getState("tr-064.0.states.commandResult").val.length - 2);  //die reine URL wird extrahiert


    // alternative URL und sid extarktion:

    const befehl_result = getState("tr-064.0.states.commandResult").val;

    if (debug) { console.log("Antwort auf command im State tr-064.0.states.commandResult: " + befehl_result); }
    //anscheinend typeofval === string, wäre ggf. nochmal abzusichern.
    // JSON in Objekt umwandeln
    const parsedResult = JSON.parse(befehl_result);

    // URL extrahieren

    if (debug) { console.log("path from commandResult: " + parsedResult.NewURL); }

    // URL-Objekt erzeugen
    const fullCalllistUrl = new URL(parsedResult.NewURL);

    // Parameter tam index und sid extrahieren
    const sid = fullCalllistUrl.searchParams.get("sid");
    setState(DP_Fritzbox_SessionId, sid);


    const tamindex = fullCalllistUrl.searchParams.get("tamindex");

    if (debug) { console.log("sid : " + sid + " ; tamindex : " + tamindex); }

    if (debug) console.log("Extrahierter Hyperlink aus commandresult. CommandResult: " + getState("tr-064.0.states.commandResult").val + " und der extrahierte Link: " + Result_Fritzbox_HyperlinkXmlTAM);


    //Das XML File wird abgeholt, geparst und in eine JSON Struktur umgewandelt       

    httpGet(Result_Fritzbox_HyperlinkXmlTAM, function (error, response) {  // müsste man eigentlich auch per POST machen... geht aber anscheinend auch so

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
                            setState(DP_Fritzbox_AnrufbeantworterLatestMessageData, JSON.stringify(latestMessageData));
                            if (debug) { console.log("neuesten Message (nach Datum):" + JSON.stringify(latestMessageData)); }

                            const latestMessagePath = "http://" + fullCalllistUrl.host + latestMessageData.Path[0];
                            setState(DP_Fritzbox_AnrufbeantworterLatestMessagePath, latestMessagePath);
                            if (debug) { console.log("Pfad zur neusten Message):" + latestMessagePath); }


                            // wav datei abholen und in ein tempFile schreiben


                            const POSTData = `sid=${encodeURIComponent(sid)}`;
                            if (debug) { console.log("wav download : " + latestMessagePath + "  ; post data : " + POSTData); }



                            httpPost(latestMessagePath,
                                POSTData,
                                {
                                    validateCertificate: false,
                                    responseType: 'arraybuffer',
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
                                        log("Fehler beim WLAN-Zugriff: " + error, "error");
                                        return;
                                    } else {
                                        // hier noch check ergänzen, ob das wirklich eine wav datei ist...
                                        const tempFilePath = createTempFile('message.wav', response.data);

                                        // Use the new path in other scripts (e.g. sendTo)

                                        //if (debug) { console.log(response.data); }
                                        if (debug) {
                                            console.log("response header:" + response.headers)
                                            console.log(`Saved to ${tempFilePath}`);
                                        }
                                        // temp file transkribieren wenn entsprechend konfiguriert

                                        if (transcribe) {

                                            var axios = require('axios');
                                            var fs = require('node:fs');
                                            var data = new FormData();

                                            data.append('definitions', '{"locales":["de-DE"], "profanityFilterMode":"None"}');
                                            data.append('audio', fs.createReadStream(tempFilePath));

                                            if (debug) {
                                                console.log ("post form data für azure transcribe:")
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
                                                    setState(DP_Fritzbox_AnrufbeantworterLatestMessageTranskript,  (response.data.combinedPhrases?.[0]?.text || ""));
                                                })
                                                .catch(function (error) {
                                                    console.log(error);
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
    Fritzbox_Anrufbeantworter_GetMessageList();
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
- type === disconnect && extension === 40: Nachricht auf AB
bedeuten könnte
*/


on({ id: "tr-064.0.callmonitor.toPauseState", change: 'ne' }, function (obj) {
    setTimeout(function () {
        if (getState('tr-064.0.callmonitor.toPauseState').val === 'end') {
            var name = telefonname();
            if (getState("tr-064.0.callmonitor.lastCall.type").val === 'missed') {
                //    log(name + " hat aufgelegt und keine Nachricht hinterlassen");
            }

            if (getState("tr-064.0.callmonitor.lastCall.type").val === 'disconnect') {
                if (getState('tr-064.0.callmonitor.lastCall.extension').val == 40) {
                    if (debug) console.log(name + " hat auf den Anrufbeantworter gesprochen. Daten werden aus der Fritzbox ausgelesen...");
                    Fritzbox_Anrufbeantworter_GetMessageList(); //Es werden die Informationen aus dem Anrufbeantworter in der Fritzbox ausgelesen
                } else {
                    //blub    log("Der Anruf von " + telefonname() + " hat " + getState("tr-064.0.callmonitor.lastCall.duration").val + " sec gedauert");
                }
            }
        }
    }, 3000);

});
