// Helper functions for chat types
function isGroupChat(jid) {
  return jid.endsWith('@g.us');
}

function isBroadcast(jid) {
  return jid === 'status@broadcast';
}

function isPrivateChat(jid) {
  return jid.endsWith('@s.whatsapp.net');
}

module.exports = {
  isGroupChat,
  isBroadcast,
  isPrivateChat
};