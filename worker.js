  await db.prepare("UPDATE ai_conversations SET updated_at=? WHERE conversation_id=?").bind(now,conversationId).run();
  await db.prepare(`DELETE FROM ai_messages WHERE conversation_id=? AND id NOT IN (SELECT id FROM ai_messages WHERE conversation_id=? ORDER BY id DESC LIMIT ${AI_MAX_STORED_MESSAGES})`).bind(conversationId,conversationId).run();
}

function cleanCustomerAiText(value) {
  let text=String(value||"").replace(/\r\n/g,"\n").trim();
  text=text
    .replace(/^\s*[-*+]\s+/gm,"")
    .replace(/^\s*\d+[.)]\s+/gm,"")
    .replace(/\*\*(.*?)\*\*/g,"$1")
    .replace(/__(.*?)__/g,"$1")
    .replace(/\*([^*\n]+)\*/g,"$1")
    .replace(/\x60([^\x60]+)\x60/g,"$1")
    .replace(/^\s*[-*_]{3,}\s*$/gm,"")
    .replace(/^\s*\|?[-: ]+\|[-: |]+\s*$/gm,"")
    .replace(/\|/g," ")
    .replace(/[ \t]{2,}/g," ")
    .replace(/\n{3,}/g,"\n\n")
    .trim();

  const paragraphs=text.split(/\n{2,}/).map(item=>item.trim()).filter(Boolean);
  const seenParagraphs=new Set();
  const uniqueParagraphs=[];
  for(const paragraph of paragraphs){
    const key=normalizeProductText(paragraph);
    if(!key || seenParagraphs.has(key)) continue;
    seenParagraphs.add(key);
    uniqueParagraphs.push(paragraph);
  }
  text=uniqueParagraphs.join("\n\n");

  const sentences=text.split(/(?<=[.!?])\s+/);
  const seenSentences=new Set();
  const uniqueSentences=[];
  for(const sentence of sentences){
    const key=normalizeProductText(sentence);
    if(!key || seenSentences.has(key)) continue;
    seenSentences.add(key);
    uniqueSentences.push(sentence);
  }
  return uniqueSentences.join(" ").replace(/\s{2,}/g," ").trim();
}
async function runAiChat(request, env) {
  const startedAt=Date.now();
  let body;