// --- script.js ---

// Bloco JS 1/4: Setup e Funções Básicas
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, reauthenticateWithCredential, EmailAuthProvider, updatePassword, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, collection, addDoc, getDoc, setDoc, deleteDoc, onSnapshot, query, where, updateDoc, arrayRemove, arrayUnion, serverTimestamp, deleteField, orderBy, setLogLevel, getDocs, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
try { app = initializeApp(firebaseConfig); } catch (e) { console.error("Firebase initialization error:", e); alert("Erro ao inicializar a conexão."); }
const db = getFirestore(app);
const auth = getAuth(app);

let currentUserClinicId = null, currentUserRole = null, currentUserId = null, currentUserName = null, selectedPatientId = null, patientsUnsubscribe = null, assessmentsUnsubscribe = null, allPatients = [], clinicUsers = [], clinicRooms = [], clinicPreferences = { defaultAgendaView: 'monthly', defaultServiceType: 'local' }, currentAgendaView = 'monthly', currentDate = new Date(), currentAppointments = [], appointmentsUnsubscribe = null, paymentsUnsubscribe = null, membersUnsubscribe = null, roomsUnsubscribe = null, dashboardAppointmentsUnsubscribe = null, initialDataLoaded = false;

const authView = document.getElementById('auth-view'), loginContainer = document.getElementById('login-container'), registerContainer = document.getElementById('register-container'), dashboardView = document.getElementById('dashboard-view'), mainContentContainer = document.getElementById('main-content'), patientModal = document.getElementById('patient-modal'), patientQuickViewModal = document.getElementById('patient-quick-view-modal'), assessmentModal = document.getElementById('assessment-modal'), assessmentDetailModal = document.getElementById('assessment-detail-modal'), evolutionModal = document.getElementById('evolution-modal'), dischargeModal = document.getElementById('discharge-modal'), confirmModal = document.getElementById('confirm-modal'), sidebar = document.getElementById('sidebar'), mobileMenuOverlay = document.getElementById('mobile-menu-overlay'), appointmentModal = document.getElementById('appointment-modal'), financialRecordModal = document.getElementById('financial-record-modal'), changeRoleModal = document.getElementById('change-role-modal'), forcePasswordChangeModal = document.getElementById('force-password-change-modal'), clinicEditModal = document.getElementById('clinic-edit-modal'), roomModal = document.getElementById('room-modal'), patientDatalist = document.getElementById('patient-list'), loadingOverlay = document.getElementById('loading-overlay');

function showLoading() { if(loadingOverlay) loadingOverlay.classList.remove('hidden'); }
function hideLoading() { if(loadingOverlay) loadingOverlay.classList.add('hidden'); }

// Alterado para ser fechado pelo listener genérico
function openModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
function closeModal(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }

function showConfirmation(title, text, onConfirm) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-text').textContent = text;
    openModal(confirmModal);

    const confirmBtn = document.getElementById('confirm-modal-confirm');
    const cancelBtn = document.getElementById('confirm-modal-cancel');

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);


    const confirmHandler = () => { onConfirm(); closeModal(confirmModal); };
    const cancelHandler = () => { closeModal(confirmModal); };

    newConfirmBtn.addEventListener('click', confirmHandler, { once: true });
    newCancelBtn.addEventListener('click', cancelHandler, { once: true });
}

function getDateString(date) {
    if (!date) return '';
    const d = new Date(date);
    const adjustedDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
    return adjustedDate.toISOString().split('T')[0];
}

function constructPatientAddress(patient) {
    if (!patient) return '';
    const addressParts = [ patient.street || '', patient.number ? `nº ${patient.number}` : '', patient.neighborhood || '', patient.city || '', patient.state || '' ];
    return addressParts.filter(Boolean).join(', ');
}

function populatePatientDatalist() {
    if (!patientDatalist) return;
    patientDatalist.innerHTML = '';
    allPatients.sort((a, b) => a.name.localeCompare(b.name)).forEach(patient => {
        const option = document.createElement('option');
        option.value = patient.name;
        option.dataset.id = patient.id;
        patientDatalist.appendChild(option);
    });
}
// Bloco JS 1/4 FIM

// Bloco JS 2/4 INÍCIO
// --- RENDER & DATA FETCHING FUNCTIONS ---
function renderPatientList(patients) {
    const loadingMsg = mainContentContainer.querySelector("#loading-patients-msg");
    const container = mainContentContainer.querySelector('#patients-container');
    const noPatientsMsg = mainContentContainer.querySelector('#no-patients-message');
    if (!container || !noPatientsMsg || !loadingMsg) { return; }

    loadingMsg.classList.add('hidden');
    container.innerHTML = '';

    if (patients.length === 0) {
        noPatientsMsg.classList.remove('hidden');
        container.classList.add('hidden');
    } else {
        noPatientsMsg.classList.add('hidden');
        container.classList.remove('hidden');
        patients.sort((a, b) => a.name.localeCompare(b.name));

        patients.forEach(patient => {
            const age = patient.birthDate ? new Date().getFullYear() - new Date(patient.birthDate).getFullYear() : 'N/A';
            const card = document.createElement('div');
            card.className = 'p-4 hover:bg-gray-50 flex flex-col sm:flex-row justify-between sm:items-center'; 
            card.innerHTML = `
                <div class="flex-1 min-w-0">
                    <h3 class="text-lg font-bold text-blue-700 truncate">${patient.name}</h3>
                    <div class="flex flex-col sm:flex-row sm:gap-4 text-sm text-gray-600">
                        <p>${age} anos</p><p class="hidden sm:block">|</p><p>${patient.phone || 'Sem telefone'}</p>
                    </div>
                </div>
                <div class="mt-4 sm:mt-0 flex-shrink-0 flex space-x-2">
                    <!-- Botão Detalhes (Quick View - abre modal) -->
                    <button data-id="${patient.id}" class="open-quick-details-btn bg-green-100 text-green-800 font-semibold p-2 rounded-lg hover:bg-green-200 transition" title="Ver Detalhes Rápidos">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 pointer-events-none" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" /></svg>
                    </button>
                    <button data-id="${patient.id}" class="edit-patient-btn bg-yellow-100 text-yellow-800 font-semibold p-2 rounded-lg hover:bg-yellow-200 transition" title="Editar Cadastro">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 pointer-events-none" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
                    </button>
                    <button data-id="${patient.id}" class="delete-patient-btn bg-red-100 text-red-800 font-semibold p-2 rounded-lg hover:bg-red-200 transition" title="Excluir Paciente">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 pointer-events-none" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h--3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                    </button>
                </div>`;
            container.appendChild(card);
        });
    }
}

function renderPatientDetails(patient) {
    const container = mainContentContainer.querySelector('#patient-info-container');
    if(!container) return;
    const orDefault = (value) => value || 'Não informado';
    const age = patient.birthDate ? new Date().getFullYear() - new Date(patient.birthDate).getFullYear() : 'N/A';
    const fullAddress = constructPatientAddress(patient);

    container.innerHTML = `
        <h2 class="text-3xl font-bold mb-2">${patient.name}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 text-gray-700">
            <p><strong>Idade:</strong> ${age} anos</p><p><strong>Sexo:</strong> ${orDefault(patient.gender)}</p><p><strong>CPF:</strong> ${orDefault(patient.cpf)}</p>
            <p><strong>Telefone:</strong> ${orDefault(patient.phone)}</p>
            <p class="md:col-span-2 lg:col-span-3"><strong>Endereço:</strong> ${orDefault(fullAddress)}</p>
            <p class="md:col-span-2 lg:col-span-3"><strong>Responsável/Cuidador:</strong> ${orDefault(patient.caregiver)}</p>
            <p class="md:col-span-2 lg:col-span-3"><strong>Observações:</strong> ${orDefault(patient.observations)}</p>
        </div>`;
}

function renderAssessmentList(assessments) { /* ... (mesmo código da função anterior) ... */ 
    const container = mainContentContainer.querySelector('#assessments-container');
    const noAssessmentsMsg = mainContentContainer.querySelector('#no-assessments-message');
    if (!container || !noAssessmentsMsg) return;
    container.innerHTML = '';
    if (assessments.length === 0) { noAssessmentsMsg.classList.remove('hidden'); return; }
    noAssessmentsMsg.classList.add('hidden');

    assessments.forEach(assessment => {
         const assessmentDate = assessment.createdAt && assessment.createdAt.toDate
            ? assessment.createdAt.toDate().toLocaleString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'Data pendente...';
         
         const professional = clinicUsers.find(u => u.id === assessment.professionalId) || { email: 'Profissional Desconhecido' };
         const professionalName = assessment.professionalName || professional.email;

         let typeLabel = '';
         let tagClass = 'bg-gray-100 text-gray-800';
         if (assessment.type === 'initial') { typeLabel = 'Avaliação Inicial'; tagClass = 'bg-yellow-100 text-yellow-800'; }
         else if (assessment.type === 'evolution') { typeLabel = `Evolução (Sessão ${assessment.sessionNumber || 'N/A'})`; tagClass = 'bg-blue-100 text-blue-800'; }
         else if (assessment.type === 'discharge') { typeLabel = 'Alta Fisioterapêutica'; tagClass = 'bg-red-100 text-red-800'; }
         else { typeLabel = 'Registro Clínico'; }


         const card = document.createElement('div');
        card.className = `bg-gray-50 p-4 rounded-lg border border-gray-200`;
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-bold text-lg inline-block px-2 py-1 rounded-md text-sm ${tagClass}">${typeLabel}</p>
                    <p class="text-md font-semibold mt-1">Profissional: ${professionalName}</p>
                    <p class="text-sm text-gray-600">${assessmentDate}</p>
                </div>
                <button data-id="${assessment.id}" data-type="${assessment.type}" class="view-assessment-btn text-sm text-blue-600 hover:underline">Ver Detalhes</button>
            </div>
        `;
        container.appendChild(card);
    });
}
function renderMonthlyView(year, month, appointments = []) { /* ... (código reduzido por brevidade) ... */ }
function renderWeeklyView(date, appointments = []) { /* ... (código reduzido por brevidade) ... */ }
function renderDailyView(date, appointments = []) { /* ... (código reduzido por brevidade) ... */ }
function renderClinicDataForDisplay(data) { /* ... (código reduzido por brevidade) ... */ }
function renderAllPayments(payments) { /* ... (código reduzido por brevidade) ... */ }
function renderRoomsList(rooms) { /* ... (código reduzido por brevidade) ... */ }
function renderMembersList(users) { /* ... (código reduzido por brevidade) ... */ }

function populateProfessionalSelects(users, targetSelectId) { /* ... (código reduzido por brevidade) ... */ }
function populateClinicEditModal(data) { /* ... (código reduzido por brevidade) ... */ }
function populateAssessmentDetailModal(data) { /* ... (código reduzido por brevidade) ... */ }

function fetchAndRenderPatients() {
    if (!currentUserClinicId) return Promise.reject("No clinic ID");
    if (patientsUnsubscribe) patientsUnsubscribe();
    const q = query(collection(db, "clinics", currentUserClinicId, "patients"));

    return new Promise((resolve, reject) => {
        patientsUnsubscribe = onSnapshot(q, (snapshot) => {
            allPatients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            populatePatientDatalist();
            if(document.getElementById('patient-list-view')) { renderPatientList(allPatients); }
            resolve();
        }, (error) => { reject(error); });
    });
}

function fetchAndRenderAssessments(patientId) {
    if (!currentUserClinicId || !patientId) return;
    if (assessmentsUnsubscribe) assessmentsUnsubscribe();
    const q = query(collection(db, "clinics", currentUserClinicId, "patients", patientId, "assessments"), orderBy("createdAt", "desc"));
    assessmentsUnsubscribe = onSnapshot(q, (snapshot) => {
        if (selectedPatientId === patientId && document.getElementById('patient-detail-view')) {
            const assessments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAssessmentList(assessments);
        }
    }, (error) => console.error("Erro ao buscar avaliações: ", error));
}

function fetchAndRenderMembers() {
    if (!currentUserClinicId) return Promise.reject("No clinic ID");
    const q = query(collection(db, "users"), where("clinicId", "==", currentUserClinicId));
    if (membersUnsubscribe) membersUnsubscribe();
    return new Promise((resolve, reject) => {
        membersUnsubscribe = onSnapshot(q, (snapshot) => {
            clinicUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if(document.getElementById('members-list')) renderMembersList(clinicUsers);
            populateProfessionalSelects(clinicUsers, 'appointment-professional');
            populateProfessionalSelects(clinicUsers, 'assessment-professional');
            populateProfessionalSelects(clinicUsers, 'evolution-professional');
            populateProfessionalSelects(clinicUsers, 'discharge-professional');
            resolve();
        }, (error) => { reject(error); });
    });
}

function fetchAndRenderClinicData() {
     if (!currentUserClinicId) return Promise.reject("No clinic ID");
     const docRef = doc(db, 'clinics', currentUserClinicId);
     return new Promise((resolve, reject) => {
         const unsubscribe = onSnapshot(docRef, (docSnap) => {
             if (docSnap.exists()) {
                 const data = docSnap.data();
                 clinicPreferences = data.preferences || { defaultAgendaView: 'monthly', defaultServiceType: 'local' };
                 if(document.getElementById('clinic-data-display')) { renderClinicDataForDisplay(data); }
                 const selectView = document.getElementById('default-agenda-view');
                 if(selectView) { selectView.value = clinicPreferences.defaultAgendaView; }
                 const selectService = document.getElementById('default-service-type');
                 if(selectService) { selectService.value = clinicPreferences.defaultServiceType || 'local'; }
                 resolve();
             } else { reject("Clinic document not found"); }
         }, (error) => { reject(error); });
     });
 }

function fetchAndRenderRooms() {
     if (!currentUserClinicId) return Promise.reject("No clinic ID");
     const q = query(collection(db, "clinics", currentUserClinicId, "rooms"));
     if (roomsUnsubscribe) { roomsUnsubscribe(); }
     return new Promise((resolve, reject) => {
         roomsUnsubscribe = onSnapshot(q, (snapshot) => {
             clinicRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
             if(document.getElementById('rooms-list')) renderRoomsList(clinicRooms);
             resolve();
         }, (error) => { reject(error); });
     });
 }

function fetchAndRenderDashboardData() {
     if (!currentUserClinicId) return Promise.resolve();
     if (dashboardAppointmentsUnsubscribe) { dashboardAppointmentsUnsubscribe(); dashboardAppointmentsUnsubscribe = null; }
     
     const patientsCountEl = document.getElementById('active-patients-count');
     if (patientsCountEl) {
          getDocs(collection(db, "clinics", currentUserClinicId, "patients"))
           .then(snapshot => { if(document.getElementById('active-patients-count')) { patientsCountEl.textContent = snapshot.size; } })
           .catch(error => console.error("Error fetching patient count:", error));
     }

     const todayStr = getDateString(new Date());
     const q = query(collection(db, 'clinics', currentUserClinicId, 'appointments'), where('date', '==', todayStr));

     return new Promise((resolve, reject) => {
         dashboardAppointmentsUnsubscribe = onSnapshot(q, (snapshot) => {
             const currentTodayAppointmentsEl = document.getElementById('today-appointments');
             if(!currentTodayAppointmentsEl) { if (dashboardAppointmentsUnsubscribe) { dashboardAppointmentsUnsubscribe(); dashboardAppointmentsUnsubscribe = null; } resolve(); return; }

             if(snapshot.empty) { currentTodayAppointmentsEl.innerHTML = '<p class="text-gray-500">Nenhum agendamento para hoje.</p>'; } 
             else {
                 const appointments = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                 appointments.sort((a, b) => a.time.localeCompare(b.time));
                 currentTodayAppointmentsEl.innerHTML = appointments.map(app => `<div class="appointment-item p-2 bg-gray-100 rounded-md cursor-pointer" data-appointment-id="${app.id}"><p class="font-semibold">${app.time} - ${app.patientName}</p></div>`).join('');
             }
             resolve();
         }, (error) => { reject(error); });
     });
 }

function toggleAppointmentFields(type) { /* ... (código reduzido por brevidade) ... */ }

function handlePatientSearch(e) {
     const searchTerm = e.target.value.toLowerCase();
     const filteredPatients = allPatients.filter(p => p.name.toLowerCase().includes(searchTerm));
     renderPatientList(filteredPatients);
}
// Bloco JS 2/4 FIM

// Bloco JS 3/4 INÍCIO
// --- AGENDA & FORM LOGIC ---

function setupAgendaListeners() { /* ... (código reduzido por brevidade) ... */ }
function handlePrevPeriod() { /* ... (código reduzido por brevidade) ... */ }
function handleNextPeriod() { /* ... (código reduzido por brevidade) ... */ }
function handleViewChange(view) { /* ... (código reduzido por brevidade) ... */ }
function handleSearchInput(e) { /* ... (código reduzido por brevidade) ... */ }
async function updateAgenda() { /* ... (código reduzido por brevidade) ... */ }
function fetchAndRenderAllPayments() { /* ... (código reduzido por brevidade) ... */ }

function handlePatientInput(e) {
    const inputValue = e.target.value;
    const listId = e.target.getAttribute('list');
    const hiddenIdInput = document.getElementById(e.target.id.replace('-input', '-id'));

    if (!hiddenIdInput) return;

    hiddenIdInput.value = '';
    const options = document.getElementById(listId).options;
    for (let i = 0; i < options.length; i++) {
        if (options[i].value === inputValue) {
            hiddenIdInput.value = options[i].dataset.id;
            if (e.target.id === 'appointment-patient-input') {
                const serviceType = document.querySelector('input[name="serviceType"]:checked')?.value;
                if (serviceType === 'domiciliar') {
                    const patient = allPatients.find(p => p.id === hiddenIdInput.value);
                    document.getElementById('appointment-cep').value = (patient && patient.cep) ? patient.cep : '';
                    document.getElementById('appointment-street').value = (patient && patient.street) ? patient.street : '';
                    document.getElementById('appointment-number').value = (patient && patient.number) ? patient.number : '';
                    document.getElementById('appointment-neighborhood').value = (patient && patient.neighborhood) ? patient.neighborhood : '';
                    document.getElementById('appointment-city').value = (patient && patient.city) ? patient.city : '';
                    document.getElementById('appointment-state').value = (patient && patient.state) ? patient.state : '';
                }
            }
            break;
        }
    }
}

async function fetchAddressFromCEP(cep, formPrefix = 'patient') {
    const cepClean = cep.replace(/\D/g, '');
    if (cepClean.length !== 8) return;

    const streetEl = document.getElementById(`${formPrefix}-street`), neighborhoodEl = document.getElementById(`${formPrefix}-neighborhood`), cityEl = document.getElementById(`${formPrefix}-city`), stateEl = document.getElementById(`${formPrefix}-state`), numberEl = document.getElementById(`${formPrefix}-number`);

    if (!streetEl || !neighborhoodEl || !cityEl || !stateEl) { console.error("Campos de endereço não encontrados:", formPrefix); return; }

    try {
        showLoading();
        const response = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`);
        const data = await response.json();
        
        if (data.erro) {
            streetEl.value = ''; neighborhoodEl.value = ''; cityEl.value = ''; stateEl.value = '';
        } else {
            streetEl.value = data.logradouro || ''; neighborhoodEl.value = data.bairro || ''; cityEl.value = data.localidade || ''; stateEl.value = data.uf || '';
            if (numberEl) numberEl.focus();
        }
    } catch (error) {
        console.error("Erro ao buscar CEP:", error);
    } finally {
        hideLoading();
    }
}

// ... (Funções openAssessmentModal, openEvolutionModal, openDischargeModal, openAppointmentDetailModal)
// ... (Funções de submissão de formulário já definidas no Bloco 5/6 da resposta anterior)
// Bloco JS 3/4 FIM

// Bloco JS 4/4 INÍCIO
// --- NAVIGATION & APP LIFECYCLE ---
function switchView(viewName) {
     console.log(`Switching view to: ${viewName}`);
    showLoading();

    [patientsUnsubscribe, appointmentsUnsubscribe, paymentsUnsubscribe, membersUnsubscribe, roomsUnsubscribe, dashboardAppointmentsUnsubscribe, assessmentsUnsubscribe].forEach(unsub => { if(unsub) { unsub(); } });
    
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.getElementById(`nav-${viewName}`);
    if (activeLink) activeLink.classList.add('active');

    mainContentContainer.querySelectorAll('.page-content').forEach(page => { page.classList.remove('active'); });

    const targetPage = document.getElementById(`page-${viewName}`);
    if(targetPage) { targetPage.classList.add('active'); } else { hideLoading(); return; }

    const fetchDataPromises = [];

    if (viewName === 'inicio') { fetchDataPromises.push(fetchAndRenderDashboardData()); } 
    else if (viewName === 'pacientes') {
        if(allPatients.length > 0) renderPatientList(allPatients); else fetchDataPromises.push(fetchAndRenderPatients());
        const searchInput = mainContentContainer.querySelector('#search-patient'); if (searchInput) { const newSearchInput = searchInput.cloneNode(true); searchInput.parentNode.replaceChild(newSearchInput, searchInput); newSearchInput.addEventListener('input', handlePatientSearch); }
        selectedPatientId = null;
    } 
    else if (viewName === 'agenda') { currentAgendaView = clinicPreferences.defaultAgendaView; setupAgendaListeners(); fetchDataPromises.push(updateAgenda()); } 
    else if(viewName === 'financeiro') { populatePatientDatalist(); fetchDataPromises.push(fetchAndRenderAllPayments()); } 
    else if (viewName === 'configuracoes') {
        const adminView = document.getElementById('admin-view'); const nonAdminView = document.getElementById('non-admin-view');
        
        fetchDataPromises.push(fetchAndRenderMembers()); 
        fetchDataPromises.push(fetchAndRenderRooms()); 
        
        if (currentUserRole === 'admin') {
            if(nonAdminView) nonAdminView.classList.add('hidden'); 
            if(adminView) adminView.classList.remove('hidden');
            
            fetchDataPromises.push(fetchAndRenderClinicData());
            if(clinicUsers.length > 0) renderMembersList(clinicUsers);
            if(clinicRooms.length > 0) renderRoomsList(clinicRooms);

            document.getElementById('create-user-form').addEventListener('submit', handleCreateUser);
            document.getElementById('save-preferences-btn').addEventListener('click', handleSavePreferences);
            document.getElementById('edit-clinic-data-btn').addEventListener('click', async () => {
                 showLoading();
                 const clinicDocSnap = await getDoc(doc(db, 'clinics', currentUserClinicId));
                 if (clinicDocSnap.exists()) { populateClinicEditModal(clinicDocSnap.data()); openModal(clinicEditModal); }
                 hideLoading();
            });
        } else { if(adminView) adminView.classList.add('hidden'); if(nonAdminView) nonAdminView.classList.remove('hidden'); }
    }
     
    Promise.allSettled(fetchDataPromises).then(() => { hideLoading(); }).catch(err => { hideLoading(); });
}

// --- EVENT LISTENERS ---

document.body.addEventListener('click', async (e) => {
    if (!currentUserClinicId && !e.target.closest('#force-password-change-form')) return;

    const target = e.target;
    
     if (target.closest('.open-quick-details-btn')) { 
        e.stopPropagation();
        const patientId = target.closest('.open-quick-details-btn').dataset.id;
        openPatientQuickViewModal(patientId);
    } else if (target.closest('.view-assessment-btn')) {
        if(!selectedPatientId) return;
        const assessmentId = target.closest('.view-assessment-btn').dataset.id;
        try {
           const docSnap = await getDoc(doc(db, 'clinics', currentUserClinicId, 'patients', selectedPatientId, 'assessments', assessmentId));
           if (docSnap.exists()) {
               populateAssessmentDetailModal(docSnap.data());
               assessmentDetailModal.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
               assessmentDetailModal.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
               const type = docSnap.data().type;
               const targetTab = (type === 'evolution' ? 'detail-tab-evolution' : (type === 'discharge' ? 'detail-tab-discharge' : 'detail-tab1'));
               assessmentDetailModal.querySelector(`#${targetTab}`)?.classList.remove('hidden');
               assessmentDetailModal.querySelector(`[data-tab="${targetTab}"]`)?.classList.add('active');
               openModal(assessmentDetailModal);
           }
        } catch(error) { console.error("Erro ao buscar detalhes:", error); }
    }
    // ... (restante das ações específicas de botões que você precise)
});

// Listener para navegação na barra lateral
document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const viewName = e.currentTarget.id.replace('nav-', '');
        switchView(viewName);
        if (window.innerWidth < 768) {
            sidebar.classList.add('-translate-x-full');
            mobileMenuOverlay.classList.add('hidden');
        }
    });
});

// Listener para campos condicionais em modais e toggle PF/PJ
document.body.addEventListener('change', (e) => {
    if (e.target.closest('#assessment-modal')) {
        if(e.target.id === 'dor-eva') { document.getElementById('dor-local-container')?.classList.toggle('hidden', e.target.value == 0); }
        if(e.target.id === 'edema') { document.getElementById('edema-local-container')?.classList.toggle('hidden', e.target.value === 'Não'); }
    }
    if (e.target.matches('input[name="serviceType"]')) { toggleAppointmentFields(e.target.value); }
    if (e.target.matches('input[name="accountType"]')) {
        const isPf = e.target.value === 'pf';
        document.getElementById('pf-fields').classList.toggle('hidden', !isPf);
        document.getElementById('pj-fields').classList.toggle('hidden', isPf);
    }
});

// --- FECHAMENTO DOS MODAIS (X, Cancelar e Backdrop) ---
document.body.addEventListener('click', (e) => {
    const target = e.target;
    const modalBackdrop = target.closest('.modal-backdrop');

    if (modalBackdrop) {
        // Clicou no 'X' ou 'Cancelar' (com classe close-modal-btn)
        if (target.closest('.close-modal-btn')) {
            closeModal(modalBackdrop);
            return;
        }

        // Clicou no backdrop (fundo escurecido)
        if (target.classList.contains('modal-backdrop') && !target.closest('.bg-white')) {
            closeModal(modalBackdrop);
        }
    }
});

// --- INICIALIZAÇÃO DA AUTENTICAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        const loadUserProfileAndDashboard = async (retriesLeft = 5) => {
            const userDocRef = doc(db, 'users', user.uid);
            try {
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists() && userDocSnap.data().clinicId) {
                    const userData = userDocSnap.data();
                    const clinicDocSnap = await getDoc(doc(db, 'clinics', userData.clinicId));

                    if (!clinicDocSnap.exists() || clinicDocSnap.data().status === 'inactive') { await signOut(auth); hideLoading(); return; }

                    const clinicData = clinicDocSnap.data();
                    clinicPreferences = clinicData.preferences || { defaultAgendaView: 'monthly', defaultServiceType: 'local' };

                    if (userData.mustChangePassword) { authView.classList.add('hidden'); dashboardView.classList.add('hidden'); hideLoading(); openModal(forcePasswordChangeModal); return; }

                    currentUserClinicId = userData.clinicId; currentUserRole = userData.role; currentUserName = userData.name || user.email;
                    document.getElementById('user-email').textContent = user.email; document.getElementById('clinic-name-sidebar').textContent = clinicData.name;

                    showLoading();
                    await Promise.allSettled([ fetchAndRenderMembers(), fetchAndRenderRooms(), fetchAndRenderPatients() ]);
                    initialDataLoaded = true;

                    authView.classList.add('hidden'); dashboardView.classList.remove('hidden');
                    switchView('inicio');

                } else {
                    if (retriesLeft > 0) { setTimeout(() => loadUserProfileAndDashboard(retriesLeft - 1), 1000); } 
                    else { document.getElementById('login-error').textContent = 'Erro ao carregar perfil.'; await signOut(auth); hideLoading(); }
                }
            } catch (error) { await signOut(auth); hideLoading(); }
        };

        loadUserProfileAndDashboard();

    } else {
        hideLoading();
        // Reset Global State
        [patientsUnsubscribe, assessmentsUnsubscribe, appointmentsUnsubscribe, paymentsUnsubscribe, membersUnsubscribe, roomsUnsubscribe, dashboardAppointmentsUnsubscribe].forEach(unsub => { if(unsub) { unsub(); } });
        currentUserClinicId = null; currentUserRole = null; currentUserId = null; allPatients = []; clinicUsers = []; clinicRooms = [];
        dashboardView.classList.add('hidden'); authView.classList.remove('hidden'); loginContainer.classList.remove('hidden'); registerContainer.classList.add('hidden');
    }
});// JavaScript Document