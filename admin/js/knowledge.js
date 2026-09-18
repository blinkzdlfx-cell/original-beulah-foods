import { supabase } from "./lib/supabaseClient.js";
import { requireAdmin } from "./services/adminAuthService.js";

const form=document.getElementById("knowledge-form");
const idInput=document.getElementById("knowledge-id");
const titleInput=document.getElementById("knowledge-title");
const categoryInput=document.getElementById("knowledge-category");
const tagsInput=document.getElementById("knowledge-tags");
const contentInput=document.getElementById("knowledge-content");
const activeInput=document.getElementById("knowledge-active");
const rows=document.getElementById("knowledge-rows");
const status=document.getElementById("knowledge-status");
const saveButton=document.getElementById("knowledge-save");

let session=null;

function showStatus(message,error=false){status.textContent=message;status.className=`alert ${error?"error":"success"}`;status.hidden=false;}
function escapeHtml(value){return String(value??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function clearForm(){idInput.value="";titleInput.value="";categoryInput.value="general";tagsInput.value="";contentInput.value="";activeInput.checked=true;saveButton.textContent="Save knowledge";}
function fill(entry){idInput.value=entry.id;titleInput.value=entry.title||"";categoryInput.value=entry.category||"general";tagsInput.value=(entry.tags||[]).join(", ");contentInput.value=entry.content||"";activeInput.checked=entry.is_active!==false;saveButton.textContent="Update knowledge";window.scrollTo({top:0,behavior:"smooth"});}
function formatDate(value){return value?new Date(value).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"}):"—";}

async function load(){
  const {data,error}=await supabase.from("ai_knowledge").select("id,title,category,tags,content,is_active,created_at,updated_at").order("updated_at",{ascending:false});
  if(error) throw error;
  rows.innerHTML="";
  for(const entry of data||[]){
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><strong>${escapeHtml(entry.title)}</strong></td><td>${escapeHtml(entry.category)}</td><td>${entry.is_active?"Active":"Inactive"}</td><td>${escapeHtml(formatDate(entry.updated_at))}</td><td><div class="actions"><button class="btn btn-secondary edit-entry" type="button">Edit</button><button class="btn btn-secondary delete-entry" type="button">Delete</button></div></td>`;
    tr.querySelector(".edit-entry").addEventListener("click",()=>fill(entry));
    tr.querySelector(".delete-entry").addEventListener("click",async()=>{
      if(!confirm("Delete this AI knowledge entry?")) return;
      const {error}=await supabase.from("ai_knowledge").delete().eq("id",entry.id);
      if(error){showStatus(error.message,true);return;}
      if(idInput.value===entry.id) clearForm();
      await load(); showStatus("Knowledge entry deleted.");
    });
    rows.append(tr);
  }
}

form.addEventListener("submit",async event=>{
  event.preventDefault();
  const title=titleInput.value.trim(), content=contentInput.value.trim();
  if(!title||!content){showStatus("Title and knowledge content are required.",true);return;}
  saveButton.disabled=true; saveButton.textContent="Saving…";
  try{
    const payload={title,category:categoryInput.value,content,tags:tagsInput.value.split(",").map(v=>v.trim()).filter(Boolean),is_active:activeInput.checked,created_by:session.user.id};
    let result;
    if(idInput.value) result=await supabase.from("ai_knowledge").update(payload).eq("id",idInput.value);
    else result=await supabase.from("ai_knowledge").insert(payload);
    if(result.error) throw result.error;
    clearForm(); await load(); showStatus("Knowledge entry saved.");
  }catch(error){console.error(error);showStatus(error?.message||"Could not save knowledge.",true);}
  finally{saveButton.disabled=false;if(!idInput.value)saveButton.textContent="Save knowledge";}
});
document.getElementById("knowledge-clear").addEventListener("click",clearForm);

(async function init(){
  try{
    const access=await requireAdmin();
    if(!access){location.href="/admin/";return;}
    session=access.session;
    document.querySelector(".admin-shell").classList.remove("admin-shell--loading");
    document.getElementById("admin-app").classList.remove("hidden");
    await load();
  }catch(error){console.error(error);showStatus(error?.message||"Could not load AI knowledge.",true);}
})();