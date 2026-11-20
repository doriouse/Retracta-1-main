export function createMapHtml(latitude, longitude) {
  return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#map{height:100%;margin:0;font:14px sans-serif}.tools{position:absolute;z-index:1000;top:10px;left:10px;right:10px;display:flex;gap:6px}.tools input{min-width:0;flex:1;padding:11px;border:1px solid #ccc;border-radius:9px;background:white}.tools button,.choose{border:0;border-radius:9px;background:#2c6fe0;color:white;padding:10px;font-weight:bold}.choose{position:absolute;z-index:1000;bottom:16px;left:15%;width:70%;padding:14px}.coords{position:absolute;z-index:1000;bottom:68px;left:10px;background:#fff;padding:6px 9px;border-radius:8px;font-size:12px}</style>
</head><body><div id="map"></div>
<div class="tools"><input id="query" placeholder="Buscar cidade ou endereço"><button onclick="searchPlace()">Buscar</button></div>
<div class="coords" id="coords"></div><button class="choose" onclick="selectPoint()">Usar este local</button>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const map=L.map('map').setView([${Number(latitude)},${Number(longitude)}],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
let point=L.marker([${Number(latitude)},${Number(longitude)}]).addTo(map);
function updatePoint(latlng){point.setLatLng(latlng);document.getElementById('coords').textContent=latlng.lat.toFixed(5)+', '+latlng.lng.toFixed(5)}
updatePoint(point.getLatLng());
map.on('click',event=>updatePoint(event.latlng));
async function searchPlace(){const query=document.getElementById('query').value.trim();if(!query)return;try{const response=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(query),{headers:{'Accept-Language':'pt-BR'}});const results=await response.json();if(!results.length){alert('Local não encontrado.');return}const result=results[0];const latlng=L.latLng(Number(result.lat),Number(result.lon));map.setView(latlng,14);updatePoint(latlng)}catch(error){alert('Não foi possível buscar esse local. Verifique a conexão.')}}</script>
<script>
function selectPoint(){const p=point.getLatLng();const message=JSON.stringify({latitude:p.lat,longitude:p.lng});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else window.parent.postMessage({type:'retracta-location',payload:message},'*')}
</script>
</body></html>`;
}
