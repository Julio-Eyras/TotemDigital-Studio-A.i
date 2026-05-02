// Configurações
const BACKEND_URL = 'http://localhost:3000'; // Substituir pela URL real do backend
const WEBSOCKET_URL = 'ws://localhost:3000/ws'; // Substituir pela URL real do WebSocket
const TOTEM_ID = 'TOTEM_WEBOS_001'; // ID único do totem (seria obtido após registro)
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN'; // Token de autenticação (seria obtido após registro)

// Elementos do DOM
const connectionStatusSpan = document.getElementById('connection-status');
const currentMediaSpan = document.getElementById('current-media');
const playerContainer = document.getElementById('player-container');

let currentPlaylist = [];
let currentMediaIndex = 0;
let websocket;

// --- Funções de Comunicação REST ---

async function fetchWithAuth(url, options = {}) {
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
    };
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

async function registerTotem() {
    try {
        // Em um cenário real, o código de ativação seria inserido manualmente ou via QR code
        // e o backend retornaria o TOTEM_ID e AUTH_TOKEN.
        // Para o protótipo, estamos usando valores fixos.
        console.log(`Registrando totem com ID: ${TOTEM_ID}`);
        // const registrationData = await fetch(`${BACKEND_URL}/api/v1/totem/register`, {
        //     method: 'POST',
        //     body: JSON.stringify({ activation_code: 'XYZ123' })
        // });
        // TOTEM_ID = registrationData.id;
        // AUTH_TOKEN = registrationData.token;
        console.log('Totem registrado (simulado).');
    } catch (error) {
        console.error('Erro ao registrar totem:', error);
    }
}

async function getTotemConfig() {
    try {
        const config = await fetchWithAuth(`${BACKEND_URL}/api/v1/totem/${TOTEM_ID}/config`);
        console.log('Configuração do Totem:', config);
        // Atualizar configurações locais se necessário
    } catch (error) {
        console.error('Erro ao obter configuração do totem:', error);
    }
}

async function getScheduleAndPlaylist() {
    try {
        const schedule = await fetchWithAuth(`${BACKEND_URL}/api/v1/totem/${TOTEM_ID}/schedule`);
        console.log('Agendamento recebido:', schedule);
        if (schedule && schedule.playlist && schedule.playlist.midias) {
            currentPlaylist = schedule.playlist.midias;
            currentMediaIndex = 0;
            console.log('Playlist atualizada:', currentPlaylist);
            startPlayback();
        } else {
            console.log('Nenhuma playlist agendada ou playlist vazia.');
            playerContainer.innerHTML = '<p>Nenhuma mídia agendada.</p>';
        }
    } catch (error) {
        console.error('Erro ao obter agendamento e playlist:', error);
        playerContainer.innerHTML = '<p>Erro ao carregar agendamento.</p>';
    }
}

async function sendStatusUpdate(statusData) {
    try {
        await fetchWithAuth(`${BACKEND_URL}/api/v1/totem/${TOTEM_ID}/status`, {
            method: 'POST',
            body: JSON.stringify(statusData)
        });
        console.log('Status enviado:', statusData);
    } catch (error) {
        console.error('Erro ao enviar status:', error);
    }
}

// --- Funções de Comunicação WebSocket ---

function connectWebSocket() {
    websocket = new WebSocket(`${WEBSOCKET_URL}?token=${AUTH_TOKEN}&totem_id=${TOTEM_ID}`);

    websocket.onopen = () => {
        console.log('Conexão WebSocket estabelecida.');
        connectionStatusSpan.textContent = 'Conectado';
        sendStatusUpdate({ type: 'online', message: 'Player online e conectado via WebSocket.' });
        websocket.send(JSON.stringify({ command: 'player_ready', totem_id: TOTEM_ID }));
    };

    websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Mensagem WebSocket recebida:', message);
        handleWebSocketCommand(message);
    };

    websocket.onclose = () => {
        console.log('Conexão WebSocket fechada. Tentando reconectar em 5 segundos...');
        connectionStatusSpan.textContent = 'Desconectado';
        setTimeout(connectWebSocket, 5000);
    };

    websocket.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
        connectionStatusSpan.textContent = 'Erro';
        websocket.close();
    };
}

function handleWebSocketCommand(command) {
    switch (command.command) {
        case 'update_schedule':
            console.log('Comando: Atualizar agendamento.');
            getScheduleAndPlaylist();
            break;
        case 'play_now':
            console.log('Comando: Reproduzir agora', command.playlist_id);
            // Lógica para carregar e reproduzir uma playlist específica imediatamente
            break;
        case 'reboot_device':
            console.log('Comando: Reiniciar dispositivo (simulado).');
            // Em um webOS real, usaria a API do webOS Signage para reiniciar
            // webOS.service.request('luna://com.webos.service.system', { method: 'reboot' });
            break;
        case 'restart_player':
            console.log('Comando: Reiniciar player (simulado).');
            window.location.reload();
            break;
        case 'emergency_alert':
            console.log('Comando: Alerta de emergência!', command.mensagem);
            displayEmergencyAlert(command.mensagem, command.midia_id);
            break;
        default:
            console.log('Comando desconhecido:', command.command);
    }
}

// --- Funções de Reprodução de Mídia (Simulado) ---

function startPlayback() {
    if (currentPlaylist.length === 0) {
        playerContainer.innerHTML = '<p>Nenhuma mídia para reproduzir.</p>';
        currentMediaSpan.textContent = 'Nenhuma';
        return;
    }

    playNextMedia();
}

function playNextMedia() {
    if (currentPlaylist.length === 0) return;

    const media = currentPlaylist[currentMediaIndex];
    if (!media) {
        // Reinicia a playlist ou para se for uma única passagem
        currentMediaIndex = 0;
        playNextMedia();
        return;
    }

    console.log(`Reproduzindo: ${media.nome} (${media.url_arquivo})`);
    currentMediaSpan.textContent = media.nome;
    playerContainer.innerHTML = ''; // Limpa o container

    let mediaElement;
    if (media.tipo_midia_id === 1) { // Supondo 1 para vídeo
        mediaElement = document.createElement('video');
        mediaElement.src = media.url_arquivo;
        mediaElement.autoplay = true;
        mediaElement.controls = false;
        mediaElement.onended = () => {
            sendStatusUpdate({ type: 'media_ended', media_id: media.id_midia });
            currentMediaIndex = (currentMediaIndex + 1) % currentPlaylist.length;
            playNextMedia();
        };
        mediaElement.onerror = (e) => {
            console.error('Erro ao reproduzir vídeo:', e);
            sendStatusUpdate({ type: 'media_error', media_id: media.id_midia, error: e.message });
            currentMediaIndex = (currentMediaIndex + 1) % currentPlaylist.length;
            playNextMedia();
        };
    } else if (media.tipo_midia_id === 2) { // Supondo 2 para imagem
        mediaElement = document.createElement('img');
        mediaElement.src = media.url_arquivo;
        setTimeout(() => {
            sendStatusUpdate({ type: 'media_ended', media_id: media.id_midia });
            currentMediaIndex = (currentMediaIndex + 1) % currentPlaylist.length;
            playNextMedia();
        }, (media.duracao_exibicao_override || media.duracao_segundos || 10) * 1000); // Duração padrão de 10s
        mediaElement.onerror = (e) => {
            console.error('Erro ao exibir imagem:', e);
            sendStatusUpdate({ type: 'media_error', media_id: media.id_midia, error: e.message });
            currentMediaIndex = (currentMediaIndex + 1) % currentPlaylist.length;
            playNextMedia();
        };
    } else {
        console.warn('Tipo de mídia não suportado para reprodução:', media.tipo_midia_id);
        playerContainer.innerHTML = `<p>Tipo de mídia não suportado: ${media.nome}</p>`;
        currentMediaIndex = (currentMediaIndex + 1) % currentPlaylist.length;
        setTimeout(playNextMedia, 5000); // Tenta a próxima mídia após 5 segundos
        return;
    }

    playerContainer.appendChild(mediaElement);
    sendStatusUpdate({ type: 'media_started', media_id: media.id_midia });
}

function displayEmergencyAlert(message, mediaId) {
    playerContainer.innerHTML = `
        <div style="background-color: red; color: white; padding: 50px; text-align: center; font-size: 2em;">
            <h1>ALERTA DE EMERGÊNCIA!</h1>
            <p>${message}</p>
        </div>
    `;
    if (mediaId) {
        // Lógica para exibir mídia de emergência específica
        // Por simplicidade, apenas a mensagem é exibida aqui.
    }
    // Parar a reprodução normal e aguardar comando para retomar
}

// --- Inicialização ---

document.addEventListener('DOMContentLoaded', () => {
    console.log('SmarTotem webOS Player iniciado.');
    registerTotem();
    getTotemConfig();
    getScheduleAndPlaylist();
    connectWebSocket();

    // Simula um heartbeat a cada 30 segundos
    setInterval(() => {
        sendStatusUpdate({ type: 'heartbeat', timestamp: new Date().toISOString() });
    }, 30000);
});

// Exemplo de dados de playlist (simulado do backend)
// Em um cenário real, isso viria do getScheduleAndPlaylist
/*
currentPlaylist = [
    { id_midia: 1, nome: 'Video Publicidade 1', url_arquivo: 'https://www.w3schools.com/html/mov_bbb.mp4', tipo_midia_id: 1, duracao_segundos: 10 },
    { id_midia: 2, nome: 'Imagem Promocional', url_arquivo: 'https://www.w3schools.com/w3images/fjords.jpg', tipo_midia_id: 2, duracao_segundos: 5 },
    { id_midia: 3, nome: 'Video Publicidade 2', url_arquivo: 'https://www.w3schools.com/html/movie.mp4', tipo_midia_id: 1, duracao_segundos: 8 }
];
*/
