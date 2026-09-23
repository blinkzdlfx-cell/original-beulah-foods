import { supabase } from "./lib/supabaseClient.js";
import { requireAdmin } from "./services/adminAuthService.js";

const status = document.getElementById("announcement-status");
const rows = document.getElementById("announcement-rows");
const form = document.getElementById("announcement-form");
const id = document.getElementById("announcement-id");
const title = document.getElementById("announcement-title");
const description = document.getElementById("announcement-description");
const target = document.getElementById("announcement-target");
const mode = document.getElementById("announcement-mode");
const ctaText = document.getElementById("announcement-cta-text");
const ctaUrl = document.getElementById("announcement-cta-url");
const dismissible = document.getElementById("announcement-dismissible");
const showOnce = document.getElementById("announcement-show-once");
const sort = document.getElementById("announcement-sort");
const start = document.getElementById("announcement-start");
const expires = document.getElementById("announcement-expires");
const active = document.getElementById("announcement-active");
const image = document.getElementById("announcement-image");
const preview = document.getElementById("announcement-image-preview");
const save = document.getElementById("announcement-save");
const clear = document.getElementById("announcement-clear");
const BUCKET = "announcement-images";
const MAX = 5 * 1024 * 1024;
let records = [];
let removeCurrentImage = false;

function escapeHtml(v){return String(v ?? "").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function imageUrl(path){return path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : "";}
function show(message,error=false){status.textContent=message;status.className=`alert${error?" error":""}`;status.hidden=false;}
function clearStatus(){status.hidden=true;}
function toLocal(value){return value ? new Date(value).toISOString().slice(0,16) : "";}
function reset(){form.reset();id.value="";sort.value="0";active.checked=true;dismissible.checked=true;showOnce.checked=false;ctaText.value="";ctaUrl.value="";preview.hidden=true;preview.innerHTML="";save.textContent="Save announcement";image.value="";removeCurrentImage=false;syncRemoveImageControl();}
function normalizeCtaUrl(value){const raw=String(value||"").trim();if(!raw)return null;if(raw.startsWith("/"))return raw;try{const parsed=new URL(raw);if(parsed.protocol==="http:"||parsed.protocol==="https:")return parsed.href;}catch{}throw new Error("CTA URL must be a site path or an HTTP(S) URL.");}
function validateFile(file){if(!file)return;if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>MAX)throw new Error("Images must be JPG, PNG or WebP and 5 MB or smaller.");}
function render(){rows.innerHTML=records.map(a=>`<tr><td><div class="announcement-row-title">${a.image_path?`<div><img class="announcement-thumb" src="${escapeHtml(imageUrl(a.image_path))}" alt="">`: "<div>"}<strong>${escapeHtml(a.title)}</strong></div><small>${escapeHtml(a.short_description)}</small></div></td><td>${escapeHtml(a.target_page)}</td><td>${escapeHtml(a.display_type||a.display_mode||"inline")}</td><td>${a.sort_order}</td><td>${a.is_active?'<span class="badge">Active</span>':'Inactive'}</td><td><button class="btn btn-secondary" data-edit="${a.id}">Edit</button> <button class="btn btn-secondary" data-toggle="${a.id}">${a.is_active?"Unpublish":"Publish"}</button></td></tr>`).join("")||'<tr><td colspan="6" class="muted">No announcements yet.</td></tr>';
rows.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>edit(b.dataset.edit)));
rows.querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click",()=>toggle(b.dataset.toggle)));
}
async function load(){rows.innerHTML='<tr><td colspan="6" class="muted">Loading announcements…</td></tr>';const {data,error}=await supabase.from("announcements").select("*").order("sort_order").order("created_at",{ascending:false});if(error)throw error;records=data||[];render();}
function edit(recordId){const a=records.find(x=>x.id===recordId);if(!a)return;id.value=a.id;title.value=a.title;description.value=a.short_description;target.value=a.target_page;mode.value=a.display_type||((a.display_mode==="banner")?"banner":"inline");sort.value=a.sort_order;ctaText.value=a.cta_text||"";ctaUrl.value=a.cta_url||"";dismissible.checked=a.dismissible!==false;showOnce.checked=Boolean(a.show_once);start.value=toLocal(a.starts_at);expires.value=toLocal(a.expires_at);active.checked=a.is_active;image.value="";removeCurrentImage=false;if(a.image_path){preview.hidden=false;preview.innerHTML=`<img src="${escapeHtml(imageUrl(a.image_path))}" alt="Announcement image preview">`;}else{preview.hidden=true;preview.innerHTML="";}syncRemoveImageControl();save.textContent="Update announcement";window.scrollTo({top:0,behavior:"smooth"});}
async function upload(file){validateFile(file);const ext=file.type==="image/jpeg"?"jpg":file.type.split("/")[1];const path=`announcements/${crypto.randomUUID()}.${ext}`;const {error}=await supabase.storage.from(BUCKET).upload(path,file,{contentType:file.type,cacheControl:"31536000",upsert:false});if(error)throw error;return path;}
async function remove(path){if(path)await supabase.storage.from(BUCKET).remove([path]);}
form.addEventListener("submit",async e=>{e.preventDefault();clearStatus();save.disabled=true;save.textContent="Saving…";let uploaded=null;try{const existing=records.find(x=>x.id===id.value);const removeExisting=removeCurrentImage;const file=image.files?.[0];if(file)uploaded=await upload(file);const payload={title:title.value.trim(),short_description:description.value.trim(),target_page:target.value,display_mode:mode.value==="banner"?"banner":"card",display_type:mode.value,cta_text:ctaText.value.trim()||null,cta_url:normalizeCtaUrl(ctaUrl.value),dismissible:dismissible.checked,show_once:showOnce.checked,sort_order:Math.max(0,Number.parseInt(sort.value,10)||0),starts_at:start.value?new Date(start.value).toISOString():null,expires_at:expires.value?new Date(expires.value).toISOString():null,is_active:active.checked,image_path:uploaded || (removeExisting ? null : existing?.image_path || null)};let error;if(id.value){({error}=await supabase.from("announcements").update(payload).eq("id",id.value));if(error)throw error;if(existing?.image_path && (uploaded || removeExisting))await remove(existing.image_path);}else{({error}=await supabase.from("announcements").insert(payload));if(error)throw error;}show("Announcement saved.");reset();await load();}catch(e){if(uploaded)await remove(uploaded);show(e?.message||"Could not save announcement.",true);}finally{save.disabled=false;if(!id.value)save.textContent="Save announcement";}});
image.addEventListener("change",()=>{const file=image.files?.[0];if(!file){syncRemoveImageControl();return;}try{validateFile(file);removeCurrentImage=false;preview.hidden=false;preview.innerHTML=`<img src="${escapeHtml(URL.createObjectURL(file))}" alt="Announcement image preview">`;syncRemoveImageControl();}catch(e){image.value="";show(e.message,true);}});

function syncRemoveImageControl(){const button=document.getElementById("announcement-remove-image");const hasExisting=Boolean(id.value && records.find(x=>x.id===id.value)?.image_path);if(!button)return;button.hidden=!hasExisting;button.disabled=!hasExisting;button.textContent=removeCurrentImage?"Undo image removal":"Remove current image";button.classList.toggle("is-active",removeCurrentImage);preview.classList.toggle("is-marked-for-removal",removeCurrentImage);}

document.getElementById("announcement-remove-image")?.addEventListener("click",()=>{removeCurrentImage=!removeCurrentImage;syncRemoveImageControl();if(removeCurrentImage){show("Current image will be deleted when you save this announcement.");}else{clearStatus();}});
clear.addEventListener("click",reset);
async function toggle(recordId){const a=records.find(x=>x.id===recordId);if(!a)return;const {error}=await supabase.from("announcements").update({is_active:!a.is_active}).eq("id",recordId);if(error)show(error.message,true);else await load();}
(async()=>{try{if(!await requireAdmin()){location.href="/admin/";return;}await load();}catch(e){show(e?.message||"Could not load announcements.",true);}})();