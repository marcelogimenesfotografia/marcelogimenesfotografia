import { db, currentUserClinicId, currentUserRole, selectedPatientId, allPatients, clinicUsers, clinicRooms, currentAppointments, assessmentsUnsubscribe, currentDate, currentAgendaView, setGlobalState } from '../main.js';
import { doc, getDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import * as Utils from './utils.js';
import * as Data from './data.js';
import * as Render from './render.js';
import { toggleAppointmentFields } from './handlers.js'; // Import utility function from handlers

// --- SHARED ELEMENTS ---
const mainContentContainer = document.getElementById('main-content');
const patientModal = document.getElementById('patient-modal');
const assessmentModal = document.getElementById('assessment-modal');
const evolutionModal = document.getElementById('evolution-modal');
const dischargeModal = document.getElementById('discharge-modal');
const appointmentModal = document.getElementById('appointment-modal');
const financialRecordModal = document.getElementById('financial-record-modal');
const clinicEditModal = document.getElementById('clinic-edit-modal');
const roomModal = document.getElementById('room-modal');
const sidebar = document.getElementById('sidebar');
const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');

// --- EXPORTED GETTERS ---
export const getCurrentAgendaView = () => currentAgendaView;
export const getCurrentDate = () => currentDate;


// --- VIEW SWITCHING ---

export function switchView(viewName) {
    Utils.showLoading();

    // Clean up previous listeners
    Data.unsubscribeAll();

    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.getElementById(`nav-${viewName}`);
    if (activeLink) activeLink.classList.add('active');

    mainContentContainer.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });

    const targetPage = document.getElementById(`page-${viewName}`);
    if(!targetPage) {
         console.error(`Page #page-${viewName} not found!`);
         Utils.hideLoading();
         return;
    }
    targetPage.classList.add('active');

    // Re-fetch necessary data and setup listeners for the new view
    const fetchDataPromises = [];
    
    // Ensure core data is fetched and listeners are running
    if (allPatients.length === 0) fetchDataPromises.push(Data.fetchAndRenderPatients());
    if (clinicUsers.length === 0) fetchDataPromises.push(Data.fetchAndRenderMembers());
    if (clinicRooms.length === 0) fetchDataPromises.push(Data.fetchAndRenderRooms());
    fetchDataPromises.push(Data.fetchAndRenderClinicData()); // Re-fetch/listen for clinic data/preferences

    if (viewName === 'inicio') {
        fetchDataPromises.push(Data.fetchAndRenderDashboardData());
    } else if (viewName === 'pacientes') {
        if(allPatients.length > 0) Render.renderPatientList(allPatients);
        else fetchDataPromises.push(Data.fetchAndRenderPatients());
        // Note: Search listener handling is delegated to global handler for simplicity here
    } else if (viewName === 'agenda') {
        // Reset/Update date/view state and fetch appointments
        setGlobalState({ currentAgendaView: clinicPreferences.defaultAgendaView, currentDate: new Date() });
        Data.setupAgendaListeners();
        fetchDataPromises.push(Data.updateAgenda());
    } else if(viewName === 'financeiro') {
        Render.populatePatientDatalist();
        fetchDataPromises.push(Data.fetchAndRenderAllPayments());
    } else if (viewName === 'configuracoes') {
        const adminView = mainContentContainer.querySelector('#admin-view');
        const nonAdminView = mainContentContainer.querySelector('#non-admin-view');
        
        if (currentUserRole === 'admin') {
             if(nonAdminView) nonAdminView.classList.add('hidden');
             if(adminView) adminView.classList.remove('hidden');
             if(clinicUsers.length > 0) Render.renderMembersList(clinicUsers);
             if(clinicRooms.length > 0) Render.renderRoomsList(clinicRooms);
        } else {
             if(adminView) adminView.classList.add('hidden');
             if(nonAdminView) nonAdminView.classList.remove('hidden');
        }
    }

    Promise.allSettled(fetchDataPromises).then(() => {
        Utils.hideLoading();
    }).catch(err => {
        console.error(`Error during initial data fetch/render for ${viewName}:`, err);
        Utils.hideLoading();
    });
}

// --- SIDEBAR & MOBILE MENU ---

export function handleSidebarClick(e) {
    e.preventDefault();
    const viewName = e.currentTarget.id.replace('nav-', '');
    switchView(viewName);
    if (window.innerWidth < 768) {
        toggleMobileMenu();
    }
}

export function toggleMobileMenu() {
    const isHidden = sidebar.classList.contains('-translate-x-full');
    sidebar.classList.toggle('-translate-x-full', !isHidden);
    mobileMenuOverlay.classList.toggle('hidden', !isHidden);
}


// --- PATIENT FLOWS ---

export async function handleViewDetails(patientId) {
    setGlobalState({ selectedPatientId: patientId });
    const patientDocRef = doc(db, 'clinics', currentUserClinicId, 'patients', patientId);
    try {
        Utils.showLoading();
        const patientDocSnap = await getDoc(patientDocRef);
        if (patientDocSnap.exists()) {
            const listView = mainContentContainer.querySelector('#patient-list-view');
            const detailView = mainContentContainer.querySelector('#patient-detail-view');
            if (listView) listView.classList.remove('active');
            if (detailView) {
                detailView.classList.add('active');
                 Render.renderPatientDetails({id: patientId, ...patientDocSnap.data()});
                 Data.fetchAndRenderAssessments(patientId);
            }
        } else {
            console.error("Paciente não encontrado:", patientId);
        }
    } catch (error) {
        console.error("Erro ao buscar detalhes do paciente:", error);
    } finally {
        Utils.hideLoading();
    }
}

export function handleBackToList() {
    const detailView = mainContentContainer.querySelector('#patient-detail-view');
    const listView = mainContentContainer.querySelector('#patient-list-view');
    if(detailView) detailView.classList.remove('active');
    if(listView) listView.classList.add('active');
    if(assessmentsUnsubscribe) { assessmentsUnsubscribe(); setGlobalState({ assessmentsUnsubscribe: null }); }
    setGlobalState({ selectedPatientId: null });
}

export async function handleEditPatient(patientId) {
    const patientDocRef = doc(db, 'clinics', currentUserClinicId, 'patients', patientId);
     try {
        const docSnap = await getDoc(patientDocRef);
        if (docSnap.exists()) {
            const patient = docSnap.data();
            document.getElementById('patient-modal-title').innerText = 'Editar Paciente';
            document.getElementById('patient-id').value = patientId;
            document.getElementById('patient-name').value = patient.name || '';
            document.getElementById('patient-cpf').value = patient.cpf || '';
            document.getElementById('patient-birthDate').value = patient.birthDate || '';
            document.getElementById('patient-gender').value = patient.gender || '';
            document.getElementById('patient-phone').value = patient.phone || '';
            document.getElementById('patient-cep').value = patient.cep || '';
            document.getElementById('patient-street').value = patient.street || '';
            document.getElementById('patient-number').value = patient.number || '';
            document.getElementById('patient-neighborhood').value = patient.neighborhood || '';
            document.getElementById('patient-city').value = patient.city || '';
            document.getElementById('patient-state').value = patient.state || '';
            document.getElementById('patient-observations').value = patient.observations || '';
            Utils.openModal(patientModal);
        }
     } catch (error) {
          console.error("Erro ao buscar paciente para edição:", error);
     }
}

export function handleNewPatient() {
    document.getElementById('patient-form').reset();
    document.getElementById('patient-id').value = '';
    document.getElementById('patient-modal-title').innerText = 'Adicionar Novo Paciente';
    Utils.openModal(patientModal);
}

export async function handleViewAssessmentDetails(assessmentId) {
    const assessmentDocRef = doc(db, 'clinics', currentUserClinicId, 'patients', selectedPatientId, 'assessments', assessmentId);
     try {
        Utils.showLoading();
        const docSnap = await getDoc(assessmentDocRef);
        if (docSnap.exists()) {
            Render.populateAssessmentDetailModal(docSnap.data());
            Utils.openModal(document.getElementById('assessment-detail-modal'));
        } else {
             console.error("Avaliação não encontrada:", assessmentId);
        }
    } catch(error) {
         console.error("Erro ao buscar detalhes da avaliação:", error);
    } finally {
        Utils.hideLoading();
    }
}

export function openAssessmentModal(type, assessmentData = null) {
    if (!selectedPatientId || !currentUserClinicId) return;
    
    document.getElementById('assessment-form').reset();
    document.getElementById('assessment-form').dataset.type = type; 
    document.getElementById('assessment-form').dataset.assessmentId = ''; 

    document.getElementById('assessment-modal-title').textContent = 'Nova Avaliação Inicial';
    
    Render.populateProfessionalSelects(clinicUsers, 'assessment-professional');

    document.querySelector('#dor-local-container')?.classList.add('hidden');
    document.querySelector('#edema-local-container')?.classList.add('hidden');
    
    assessmentModal.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    assessmentModal.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));

    assessmentModal.querySelector('[data-tab="tab1"]')?.classList.add('active');
    document.getElementById('tab1')?.classList.remove('hidden');

    Utils.openModal(assessmentModal);
}

export async function openEvolutionModal() {
    if (!selectedPatientId || !currentUserClinicId) return;

    Utils.showLoading();

    document.getElementById('evolution-form').reset();
    document.getElementById('evolution-date').value = Utils.getDateString(new Date());

    let nextSessionNumber = 1;
    try {
        const assessmentsCol = collection(db, 'clinics', currentUserClinicId, 'patients', selectedPatientId, 'assessments');
        const q = query(assessmentsCol, where('type', 'in', ['initial', 'evolution']), orderBy("createdAt", "desc"), limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const lastAssessment = snapshot.docs[0].data();
            const lastSessionNumber = lastAssessment.sessionNumber || 0;
            nextSessionNumber = (lastAssessment.type === 'initial' ? 1 : lastSessionNumber + 1);
        }
    } catch (error) {
        console.error("Erro ao buscar último Nº da Sessão:", error);
    }

    document.getElementById('evolution-session-number').value = nextSessionNumber;

    Render.populateProfessionalSelects(clinicUsers, 'evolution-professional');

    Utils.hideLoading();
    Utils.openModal(evolutionModal);
}

export async function openDischargeModal() {
    if (!selectedPatientId || !currentUserClinicId) return;
    
    document.getElementById('discharge-form').reset();
    
    Render.populateProfessionalSelects(clinicUsers, 'discharge-professional');

    dischargeModal.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    dischargeModal.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));

    dischargeModal.querySelector('[data-tab="discharge-tab7"]')?.classList.add('active');
    document.getElementById('discharge-tab7')?.classList.remove('hidden');

    Utils.openModal(dischargeModal);
}


// --- AGENDA FLOWS ---

export async function openAppointmentDetailModal(appointmentId, defaultDate = null) {
     if (!currentUserClinicId) return;

     Utils.showLoading();

     document.getElementById('appointment-form').reset();
     document.getElementById('appointment-id').value = '';
     document.getElementById('delete-appointment-btn').classList.add('hidden');

     Render.populatePatientDatalist();
     Render.populateProfessionalSelects(clinicUsers, 'appointment-professional');

     const roomSelect = document.getElementById('appointment-room');
     roomSelect.innerHTML = clinicRooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('') || '<option disabled selected>Nenhuma sala</option>';


     if (appointmentId) { // Editing existing appointment
         try {
            const appointmentDocRef = doc(db, 'clinics', currentUserClinicId, 'appointments', appointmentId);
            const docSnap = await getDoc(appointmentDocRef);

            if (docSnap.exists()) {
                const appData = docSnap.data();

                document.getElementById('appointment-id').value = appointmentId;
                document.getElementById('appointment-date').value = appData.date;
                document.getElementById('appointment-modal-title').textContent = `Editar Agendamento - ${new Date(appData.date + 'T12:00:00').toLocaleDateString('pt-BR')}`;
                document.getElementById('appointment-patient-input').value = appData.patientName;
                document.getElementById('appointment-patient-id').value = appData.patientId;

                const professionalSelect = document.getElementById('appointment-professional');
                if (professionalSelect.querySelector(`option[value="${appData.professionalId}"]`)) {
                    professionalSelect.value = appData.professionalId;
                }
                if (roomSelect.querySelector(`option[value="${appData.roomId}"]`)) {
                    roomSelect.value = appData.roomId;
                }
                
                const serviceType = appData.serviceType || 'local';
                document.querySelectorAll('input[name="serviceType"]').forEach(radio => {
                     radio.checked = (radio.value === serviceType);
                });
                toggleAppointmentFields(serviceType);
                if (serviceType === 'domiciliar') {
                     const ad = appData.addressDetails || {};
                     document.getElementById('appointment-cep').value = ad.cep || '';
                     document.getElementById('appointment-street').value = ad.street || (appData.address || '');
                     document.getElementById('appointment-number').value = ad.number || '';
                     document.getElementById('appointment-neighborhood').value = ad.neighborhood || '';
                     document.getElementById('appointment-city').value = ad.city || '';
                     document.getElementById('appointment-state').value = ad.state || '';
                }

                document.getElementById('appointment-time').value = appData.time;
                document.getElementById('appointment-duration').value = appData.duration;
                document.getElementById('appointment-notes').value = appData.notes || '';

                document.getElementById('delete-appointment-btn').classList.remove('hidden');
                Utils.hideLoading();
                Utils.openModal(appointmentModal);

            } else {
                console.error("Agendamento não encontrado:", appointmentId);
                alert("Agendamento não encontrado.");
                Utils.hideLoading();
            }
         } catch(error) {
             console.error("Erro ao abrir detalhes do agendamento:", error);
             alert("Erro ao abrir detalhes do agendamento.");
             Utils.hideLoading();
         }
     } else { // Creating new appointment
        const dateToSet = defaultDate || Utils.getDateString(new Date());
        document.getElementById('appointment-date').value = dateToSet;
        document.getElementById('appointment-modal-title').textContent = `Novo Agendamento - ${new Date(dateToSet + 'T12:00:00').toLocaleDateString('pt-BR')}`;
        
        const defaultServiceType = clinicPreferences.defaultServiceType || 'local';
         document.querySelectorAll('input[name="serviceType"]').forEach(radio => {
             radio.checked = (radio.value === defaultServiceType);
         });
         toggleAppointmentFields(defaultServiceType);
        
        Utils.hideLoading();
        Utils.openModal(appointmentModal);
     }
}

// --- CONFIGURATION FLOWS ---

export async function handleEditClinicData() {
    const clinicDocRef = doc(db, 'clinics', currentUserClinicId);
     try {
         Utils.showLoading();
        const clinicDocSnap = await getDoc(clinicDocRef);
        if (clinicDocSnap.exists()) {
            Render.populateClinicEditModal(clinicDocSnap.data());
            Utils.openModal(clinicEditModal);
        }
     } catch (error) {
         console.error("Erro ao buscar dados da clínica para edição:", error);
     } finally {
          Utils.hideLoading();
     }
}

export function handleNewPayment() {
    document.getElementById('financial-record-form').reset();
    document.getElementById('financial-record-id').value = '';
    document.getElementById('financial-modal-title').innerText = 'Lançar Pagamento';
    Render.populatePatientDatalist();
    document.getElementById('financial-date').valueAsDate = new Date();
    Utils.openModal(financialRecordModal);
}

export function handleNewRoom() {
    document.getElementById('room-form').reset();
    document.getElementById('room-id').value = '';
    document.getElementById('room-modal-title').textContent = 'Adicionar Nova Sala';
    Utils.openModal(roomModal);
}

export function handleEditRoom(roomId, roomName) {
    document.getElementById('room-form').reset();
    document.getElementById('room-id').value = roomId;
    document.getElementById('room-name').value = roomName;
    document.getElementById('room-modal-title').textContent = 'Editar Sala';
    Utils.openModal(roomModal);
}

export function handleDeleteRoom(roomId, roomName) {
    Utils.showConfirmation('Excluir Sala', `Tem certeza que deseja excluir a sala "${roomName}"?`, async () => {
         Utils.showLoading();
        try {
            await deleteDoc(doc(db, 'clinics', currentUserClinicId, 'rooms', roomId));
        } catch (error) {
            console.error("Erro ao excluir sala:", error);
            alert("Erro ao excluir sala.");
        } finally {
             Utils.hideLoading();
        }
    });
}

export function handleRemoveMember(userIdToRemove, userEmail) {
    Utils.showConfirmation('Remover Membro', `Tem certeza que deseja remover ${userEmail} da clínica?`, async () => {
         Utils.showLoading();
        try {
            const userDocRef = doc(db, 'users', userIdToRemove);
            const clinicDocRef = doc(db, 'clinics', currentUserClinicId);

            await updateDoc(clinicDocRef, {
                members: arrayRemove(userIdToRemove),
                [`roles.${userIdToRemove}`]: deleteField()
            });

            await updateDoc(userDocRef, {
                clinicId: null,
                role: null
            });
        } catch (error) {
            console.error("Erro ao remover membro:", error);
            alert("Erro ao remover membro.");
        } finally {
             Utils.hideLoading();
        }
    });
}