// --- FIREBASE IMPORTS ---
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, serverTimestamp, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- MODULE IMPORTS (All other files) ---
import * as Utils from './modules/utils.js';
import * as Data from './modules/data.js';
import * as Render from './modules/render.js';
import * as Handlers from './modules/handlers.js';
import * as Auth from './modules/auth.js';
import * as Nav from './modules/navigation.js';


// --- FIREBASE CONFIG & INITIALIZATION ---
setLogLevel('debug');
const firebaseConfig = {
    apiKey: "AIzaSyB5DK7R3WGtKIUy_fMt8iNKBtz9wgdBxVs",
    authDomain: "fisioterapia-cee9d.firebaseapp.com",
    projectId: "fisioterapia-cee9d",
    storageBucket: "fisioterapia-cee9d.appspot.com",
    messagingSenderId: "551406348997",
    appId: "1:551406348997:web:7b21e0d90ebf4969955eac",
    measurementId: "G-RDGZ2MKLWK"
};

let app;
try {
    app = initializeApp(firebaseConfig);
} catch (e) {
    console.error("Firebase initialization error:", e);
    alert("Erro ao inicializar a conexão com o banco de dados. Tente recarregar a página.");
}

// --- EXPORTED FIREBASE OBJECTS ---
export const db = getFirestore(app);
export const auth = getAuth(app);
export const serverTime = serverTimestamp; // Export serverTimestamp for convenience


// --- EXPORTED GLOBAL STATE VARIABLES ---
export let currentUserClinicId = null;
export let currentUserRole = null;
export let currentUserId = null;
export let currentUserName = null;
export let selectedPatientId = null; 
export let allPatients = [];
export let clinicUsers = [];
export let clinicRooms = [];
export let clinicPreferences = { defaultAgendaView: 'monthly', defaultServiceType: 'local' };
export let currentAgendaView = 'monthly';
export let currentDate = new Date();
export let currentAppointments = [];
export let initialDataLoaded = false;

// Export Unsubscribe Variables (for cleanup)
export let patientsUnsubscribe = null;
export let assessmentsUnsubscribe = null;
export let appointmentsUnsubscribe = null;
export let paymentsUnsubscribe = null;
export let membersUnsubscribe = null;
export let roomsUnsubscribe = null;
export let dashboardAppointmentsUnsubscribe = null;


// --- EXPORTED DOM ELEMENTS (Critical ones) ---
export const authView = document.getElementById('auth-view');
export const dashboardView = document.getElementById('dashboard-view');
export const loadingOverlay = document.getElementById('loading-overlay');


// --- GLOBAL STATE SETTERS (To be used by other modules) ---
export function setGlobalState(updates) {
    for (const key in updates) {
        if (key in module.exports) {
            // Esta é a sintaxe correta para mutar uma variável exportada (live binding)
            module.exports[key] = updates[key];
        } else if (key === 'currentDate' && updates[key] instanceof Date) {
            currentDate = updates[key];
        } else {
            console.warn(`Tentativa de atribuir estado global não exportado ou inválido: ${key}`);
        }
    }
}

export function setUnsubscribe(key, func) {
    if (key in module.exports) {
        module.exports[key] = func;
    } else {
         console.error(`Attempted to set unexported unsubscribe key: ${key}`);
    }
}

// Função para iniciar a navegação, agora importada do módulo
export const switchView = Nav.switchView;

// Função para popular selects de profissional, agora importada do módulo
export const populateProfessionalSelects = Render.populateProfessionalSelects;


// --- INITIAL SETUP AND EVENT LISTENERS ---
function setupGlobalListeners() {
    // Adiciona listener para os links da sidebar (movido para Nav)
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', Nav.handleSidebarClick);
    });

    // Adiciona listener global delegado para várias ações (movido para Handlers)
    document.body.addEventListener('click', Handlers.handleGlobalClick);

    // Adiciona listeners para os modais (apenas cancel/close buttons)
    Handlers.setupModalCloseListeners();
    
    // Adiciona listeners para os formulários de autenticação
    Auth.setupAuthFormListeners();
    
    // Adiciona listeners para os campos de formulário (CEP, Datalist, Condicionais)
    Handlers.setupFormElementListeners();
}


// --- AUTH STATE CHANGE HANDLER (Centralized) ---
onAuthStateChanged(auth, async (user) => {
    Auth.handleAuthStateChange(user);
});


// --- INITIALIZATION ---
(async () => {
    // Chame a função de inicialização do Firebase e o primeiro check de autenticação
    // O check de autenticação é chamado dentro do Auth.js, mas o listener é aqui.
    
    // Inicia os listeners globais
    setupGlobalListeners();
    
    // Tente o login inicial (copiado do final do script original)
     try {
        Utils.showLoading();
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            try {
                await signInWithCustomToken(auth, __initial_auth_token);
            } catch (tokenError) {
                console.error("Custom token sign-in error:", tokenError);
                document.getElementById('login-error')?.textContent = 'Falha na autenticação automática. Faça login manualmente.';
                Utils.hideLoading();
            }
        } else {
            Utils.hideLoading();
        }
    } catch (error) { 
        console.error("Initial sign-in process error (unexpected):", error);
        document.getElementById('login-error')?.textContent = 'Erro inesperado na autenticação inicial.';
        Utils.hideLoading();
    }
    
})();