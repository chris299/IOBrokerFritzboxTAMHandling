var name2, nummer, message;


on({ id: [].concat(['0_userdata.0.Telefon.Anrufbeantworter.1.Fritzbox_AnrufbeantworterLatestMessageTranskript']), change: 'ne' }, async (obj) => {
  let value = obj.state.val;
  let oldValue = obj.oldState.val;
  name2 = getAttr(getObject('0_userdata.0.Telefon.Anrufbeantworter.1.Fritzbox_AnrufbeantworterLatestMessageData'), 'Name');
  nummer = getAttr(getObject('0_userdata.0.Telefon.Anrufbeantworter.1.Fritzbox_AnrufbeantworterLatestMessageData'), 'Number');
  message = ['Transkript der Nachricht von: ',name2,' Nummer : ',nummer,' Nachricht : ',getState('0_userdata.0.Telefon.Anrufbeantworter.1.Fritzbox_AnrufbeantworterLatestMessageTranskript').val].join('');
  console.info(message);
  sendTo('email.1', 'send', {
    text: message,
    to: 'c@vme.de',
    subject: 'AB message transkript',
  });
  sendTo("whatsapp-cmb.0", "send", {
      text: message
  });
});
