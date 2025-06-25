var name2, nummer, message;


on({ id: [].concat(['0_userdata.0.Telefon.Anrufbeantworter.1.Fritzbox_AnrufbeantworterLatestMessageTranskript']), change: 'ne' }, async (obj) => {
  let value = obj.state.val;
  let oldValue = obj.oldState.val;
  name2 = getAttr((() => { try { return JSON.parse(getState('0_userdata.0.Telefon.Anrufbeantworter.1.Fritzbox_AnrufbeantworterLatestMessageData').val); } catch (e) { return {}; }})(), 'Name');
  nummer = getAttr((() => { try { return JSON.parse(getState('0_userdata.0.Telefon.Anrufbeantworter.1.Fritzbox_AnrufbeantworterLatestMessageData').val); } catch (e) { return {}; }})(), 'Number');
  message = ['Transkript der Nachricht von: ',name2,' Nummer : ',nummer,' Nachricht : ',getState('0_userdata.0.Telefon.Anrufbeantworter.1.Fritzbox_AnrufbeantworterLatestMessageTranskript').val].join('');
  sendTo('email.1', 'send', {
    text: message,
    to: 'test@test.de',
    subject: 'AB message transkript',
    attachments:[
      { path: getState('0_userdata.0.Telefon.Anrufbeantworter.1.Fritzbox_AnrufbeantworterLatestMessageLocalPath').val, cid: 'file1' },
    ],
  });
  sendTo("whatsapp-cmb.0", "send", {
      text: message
  });
});
