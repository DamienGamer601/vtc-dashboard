// CONFIGURATION
const API_URL = 'http://localhost:25555/api/ets2/telemetry';
const DISCORD_WEBHOOK = 'TON_URL_WEBHOOK_ICI';

// VARIABLES GLOBALES
let map, truckMarker;
let startOdometer = null;
let lastTruckWear = 0;
let pointsPermis = localStorage.getItem('vtc_points') ? parseInt(localStorage.getItem('vtc_points')) : 12;

// INITIALISATION
function init() {
    initMap();
    checkFirstVisit();
    setInterval(updateDashboard, 500); // Mise à jour 2 fois par seconde
}

function initMap() {
    map = L.map('map', { crs: L.CRS.Simple, minZoom: -5 });
    // URL des tuiles (standard pour Funbit Telemetry)
    L.tileLayer('http://localhost:25555/skins/realdash/map/{z}/{x}/{y}.png').addTo(map);
    truckMarker = L.marker([0, 0]).addTo(map);
}

function updateDashboard() {
    fetch(API_URL)
        .then(res => res.json())
        .then(data => {
            if (!data.game.connected) {
                document.getElementById('status-light').innerText = "ATTENTE DU JEU...";
                return;
            }
            document.getElementById('status-light').innerText = "SYSTÈME EN LIGNE";

            // 1. Vitesse et Alertes
            const speed = Math.round(data.truck.speed);
            const limit = data.navigation.speedLimit;
            const speedEl = document.getElementById('speed');
            speedEl.innerText = speed;
            if (limit > 0 && speed > limit + 5) speedEl.classList.add('critical');
            else speedEl.classList.remove('critical');

            // 2. Temps de repos
            document.getElementById('rest-time').innerText = calculateRest(data.game.time, data.navigation.nextRestStopTime);

            // 3. Dégâts et Système de points
            handleDamage(data.truck.wearEngine, data.trailer.wear);

            // 4. Session et Carte
            if (startOdometer === null) startOdometer = data.truck.odometer;
            document.getElementById('session-dist').innerText = (data.truck.odometer - startOdometer).toFixed(2);
            updateMap(data.truck.placement);
        })
        .catch(() => document.getElementById('status-light').innerText = "SERVEUR ÉTEINT");
}

function calculateRest(current, next) {
    if (!next || next.startsWith('0001')) return "REPOS !";
    let diff = new Date(next) - new Date(current);
    if (diff < 0) return "REPOS !";
    let h = Math.floor(diff / 3600000);
    let m = Math.floor((diff % 3600000) / 60000);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
}

function handleDamage(truckWear, trailerWear) {
    document.getElementById('truck-damage-fill').style.width = (truckWear * 100) + "%";
    document.getElementById('cargo-damage-fill').style.width = (trailerWear * 100) + "%";
    
    if (truckWear > lastTruckWear + 0.01) {
        pointsPermis -= 1;
        localStorage.setItem('vtc_points', pointsPermis);
        document.getElementById('license-points').innerText = pointsPermis;
        new Audio('sounds/alerte.mp3').play().catch(()=>{});
    }
    lastTruckWear = truckWear;
}

function updateMap(placement) {
    const pos = [placement.z / 100, placement.x / 100];
    truckMarker.setLatLng(pos);
    map.setView(pos, map.getZoom());
}

function saveDriver() {
    const name = document.getElementById('driver-input').value;
    if(name) {
        localStorage.setItem('vtc_driver_name', name);
        location.reload();
    }
}

function checkFirstVisit() {
    const name = localStorage.getItem('vtc_driver_name');
    if(name) {
        document.getElementById('welcome-modal').style.display = 'none';
        document.getElementById('driver-name').innerText = `CHAUFFEUR: ${name.toUpperCase()}`;
    }
}

function envoyerRapportVTC() {
    const payload = {
        embeds: [{
            title: "🏁 FIN DE SERVICE",
            fields: [
                { name: "Chauffeur", value: localStorage.getItem('vtc_driver_name'), inline: true },
                { name: "Distance", value: document.getElementById('session-dist').innerText + " km", inline: true },
                { name: "Points Restants", value: pointsPermis + "/12", inline: true }
            ],
            color: 0x00ffcc
        }]
    };
    fetch(DISCORD_WEBHOOK, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) })
    .then(() => alert("Rapport envoyé !"));
}

window.onload = init;