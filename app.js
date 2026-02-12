// --- CONFIGURATION ---
const API_URL = 'http://192.168.1.73:25555/api/ets2/telemetry';
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1397773424323072170/N_HE1_M8gUqOGRI7NhZb0Hq6s2tWO8PFOVAAKXmJ4bzKoTSmKWHWTj7gUpbJM0g7Yq9L'; // À REMPLACER !

// --- VARIABLES ---
let map, truckMarker;
let startOdometer = null;
let lastTruckWear = 0;
let pointsPermis = parseInt(localStorage.getItem('vtc_points')) || 12;

// --- INITIALISATION ---
function init() {
    initMap();
    checkFirstVisit();
    const totalKm = parseFloat(localStorage.getItem('vtc_total_dist')) || 0;
    updateDriverRank(totalKm);
    document.getElementById('total-dist-hist').innerText = totalKm.toFixed(0);
    setInterval(updateDashboard, 500);
}

function initMap() {
    map = L.map('map', { crs: L.CRS.Simple, minZoom: -5 });
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

            // Vitesse
            const speed = Math.round(data.truck.speed);
            const limit = data.navigation.speedLimit;
            const speedEl = document.getElementById('speed');
            speedEl.innerText = speed;
            if (limit > 0 && speed > limit + 5) speedEl.classList.add('critical');
            else speedEl.classList.remove('critical');

            // Temps Repos
            document.getElementById('rest-time').innerText = calculateRest(data.game.time, data.navigation.nextRestStopTime);

            // Dégâts & Points
            handleDamage(data.truck.wearEngine, data.trailer.wear);

            // Session Km
            if (startOdometer === null) startOdometer = data.truck.odometer;
            const currentSessionDist = data.truck.odometer - startOdometer;
            document.getElementById('session-dist').innerText = currentSessionDist.toFixed(2);

            // Carte
            const pos = [data.truck.placement.z / 100, data.truck.placement.x / 100];
            truckMarker.setLatLng(pos);
            map.setView(pos, map.getZoom());
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
        pointsPermis = Math.max(0, pointsPermis - 1);
        localStorage.setItem('vtc_points', pointsPermis);
        document.getElementById('license-points').innerText = pointsPermis;
        new Audio('sounds/alerte.mp3').play().catch(()=>{});
    }
    lastTruckWear = truckWear;
}

function updateDriverRank(totalKm) {
    const thresholds = [
        { name: "STAGIAIRE", km: 0, color: "#bdc3c7" },
        { name: "JUNIOR", km: 500, color: "#2ecc71" },
        { name: "CONFIRMÉ", km: 2500, color: "#3498db" },
        { name: "LÉGENDE", km: 10000, color: "#f1c40f" }
    ];

    let currentIdx = 0;
    for (let i = 0; i < thresholds.length; i++) {
        if (totalKm >= thresholds[i].km) currentIdx = i;
    }

    const current = thresholds[currentIdx];
    const next = thresholds[currentIdx + 1];

    const rankEl = document.getElementById('driver-rank');
    rankEl.innerText = `GRADE: ${current.name}`;
    rankEl.style.color = current.color;

    if (next) {
        const progress = ((totalKm - current.km) / (next.km - current.km)) * 100;
        document.getElementById('rank-progress-fill').style.width = progress + "%";
        document.getElementById('rank-progress-fill').style.background = current.color;
        document.getElementById('rank-percentage').innerText = Math.round(progress) + "%";
        document.getElementById('next-rank-text').innerText = `Objectif : ${next.name}`;
        document.getElementById('km-remaining').innerText = `Encore ${(next.km - totalKm).toFixed(0)} km`;
    } else {
        document.getElementById('rank-progress-fill').style.width = "100%";
        document.getElementById('next-rank-text').innerText = "NIVEAU MAX";
    }
}

function envoyerRapportVTC() {
    const sessionDist = parseFloat(document.getElementById('session-dist').innerText);
    let totalKm = parseFloat(localStorage.getItem('vtc_total_dist')) || 0;
    totalKm += sessionDist;
    localStorage.setItem('vtc_total_dist', totalKm);

    const payload = {
        embeds: [{
            title: "🏁 RAPPORT DE LIVRAISON",
            color: 0x00ffcc,
            fields: [
                { name: "Chauffeur", value: localStorage.getItem('vtc_driver_name'), inline: true },
                { name: "Distance Trajet", value: sessionDist + " km", inline: true },
                { name: "Points Permis", value: pointsPermis + "/12", inline: true },
                { name: "Nouveau Total", value: totalKm.toFixed(0) + " km", inline: true }
            ],
            timestamp: new Date()
        }]
    };

    fetch(DISCORD_WEBHOOK, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) })
    .then(() => {
        alert("Rapport envoyé !");
        location.reload(); // Réinitialise la session
    });
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

window.onload = init;