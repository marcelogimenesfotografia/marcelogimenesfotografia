import { db, serverTime, currentUserClinicId, allPatients, clinicUsers, clinicRooms, currentAppointments, currentAgendaView, currentDate, selectedPatientId, clinicPreferences, patientsUnsubscribe, assessmentsUnsubscribe, appointmentsUnsubscribe, paymentsUnsubscribe, membersUnsubscribe, roomsUnsubscribe, dashboardAppointmentsUnsubscribe, setGlobalState, setUnsubscribe, populateProfessionalSelects } from '../main.js';
import { doc, collection, addDoc, getDoc, setDoc, deleteDoc, onSnapshot, query, where, updateDoc, arrayRemove, arrayUnion, deleteField, orderBy, getDocs, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import * as Utils from './utils.js';
import * as Render from './render.js';


// --- DATA FETCHING & LISTENERS ---

export function unsubscribeAll() {
    if (patientsUnsubscribe) patientsUnsubscribe();
    if (assessmentsUnsubscribe) assessmentsUnsubscribe();
    if (appointmentsUnsubscribe) appointmentsUnsubscribe();
    if (paymentsUnsubscribe) paymentsUnsubscribe();
    if (membersUnsubscribe) membersUnsubscribe();
    if (roomsUnsubscribe) roomsUnsubscribe();
    if (dashboardAppointmentsUnsubscribe) dashboardAppointmentsUnsubscribe();
    setUnsubscribe('patientsUnsubscribe', null);
    setUnsubscribe('assessmentsUnsubscribe', null);
    setUnsubscribe('appointmentsUnsubscribe', null);
    setUnsubscribe('paymentsUnsubscribe', null);
    setUnsubscribe('membersUnsubscribe', null);
    setUnsubscribe('roomsUnsubscribe', null);
    setUnsubscribe('dashboardAppointmentsUnsubscribe', null);
}

export function fetchAndRenderPatients() {
    if (!currentUserClinicId) return Promise.reject("No clinic ID");
    unsubscribeAll(); // Unsubscribe only if switching view

    const patientsCollection = collection(db, "clinics", currentUserClinicId, "patients");
    const q = query(patientsCollection);

    return new Promise((resolve, reject) => {
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newPatients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGlobalState({ allPatients: newPatients }); // Update global state
            Render.populatePatientDatalist();
            if(document.getElementById('patient-list-view')?.classList.contains('active')) {
                Render.renderPatientList(newPatients);
            }
            resolve();
        }, (error) => {
            console.error("Erro ao buscar pacientes: ", error);
            if(document.getElementById('patient-list-view')) {
                Render.renderPatientList([]);
            }
            reject(error);
        });
        setUnsubscribe('patientsUnsubscribe', unsubscribe);
    });
}

export function fetchAndRenderAssessments(patientId) {
    if (!currentUserClinicId || !patientId) return;
    if (assessmentsUnsubscribe) assessmentsUnsubscribe();

    const assessmentsCollection = collection(db, "clinics", currentUserClinicId, "patients", patientId, "assessments");
    const q = query(assessmentsCollection, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (selectedPatientId === patientId && document.getElementById('patient-detail-view')?.classList.contains('active')) {
            const assessments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            Render.renderAssessmentList(assessments);
        }
    }, (error) => console.error("Erro ao buscar avaliações: ", error));
    setUnsubscribe('assessmentsUnsubscribe', unsubscribe);
}


export function fetchAndRenderMembers() {
    if (!currentUserClinicId) return Promise.reject("No clinic ID");
    const q = query(collection(db, "users"), where("clinicId", "==", currentUserClinicId));

    if (membersUnsubscribe) membersUnsubscribe();
    return new Promise((resolve, reject) => {
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGlobalState({ clinicUsers: newUsers }); // Update global state
            
            const currentMembersListDiv = document.getElementById('members-list');
            if(currentMembersListDiv) Render.renderMembersList(newUsers);

            // Popula selects de profissionais
            populateProfessionalSelects(newUsers, 'appointment-professional');
            populateProfessionalSelects(newUsers, 'assessment-professional');
            populateProfessionalSelects(newUsers, 'evolution-professional');
            populateProfessionalSelects(newUsers, 'discharge-professional');

            resolve();
        }, (error) => {
            console.error("Erro ao buscar membros:", error);
            const currentMembersListDiv = document.getElementById('members-list');
            if(currentMembersListDiv) currentMembersListDiv.innerHTML = '<p class="text-red-500">Erro ao carregar membros. Verifique as permissões.</p>';
            reject(error);
        });
        setUnsubscribe('membersUnsubscribe', unsubscribe);
    });
}


export function fetchAndRenderClinicData() {
     if (!currentUserClinicId) return Promise.reject("No clinic ID");
     const clinicDocRef = doc(db, 'clinics', currentUserClinicId);

     return new Promise((resolve, reject) => {
         const unsubscribe = onSnapshot(clinicDocRef, (docSnap) => {
             if (docSnap.exists()) {
                 const data = docSnap.data();
                 const newPreferences = data.preferences || { defaultAgendaView: 'monthly', defaultServiceType: 'local' };
                 setGlobalState({ clinicPreferences: newPreferences, currentAgendaView: newPreferences.defaultAgendaView });

                 if(document.getElementById('clinic-data-display')) {
                     Render.renderClinicDataForDisplay(data);
                 }
                 document.getElementById('default-agenda-view')?.value = newPreferences.defaultAgendaView;
                 document.getElementById('default-service-type')?.value = newPreferences.defaultServiceType || 'local';
                 resolve();
             } else {
                 console.error("Documento da clínica não encontrado!");
                 reject("Clinic document not found");
             }
         }, (error) => {
              console.error("Erro ao buscar dados da clínica:", error);
              reject(error);
         });
         // NOTE: Clinic data listener is kept open via the Nav module's call to this.
         // We do not set the unsubscribe in the main setUnsubscribe map for this one to allow it to persist 
         // throughout the app lifecycle, but for robust cleanup, it should be managed.
         // For now, let's rely on it resolving the promise on the first snapshot.
     });
 }

export function fetchAndRenderAllPayments() {
    if (!currentUserClinicId) return Promise.resolve();
    if (paymentsUnsubscribe) paymentsUnsubscribe();

    const paymentsCol = collection(db, 'clinics', currentUserClinicId, 'payments');
    const q = query(paymentsCol, orderBy('date', 'desc'));

     return new Promise((resolve, reject) => {
         const unsubscribe = onSnapshot(q, (snapshot) => {
             const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              if(document.getElementById('payments-table-body')) {
                 Render.renderAllPayments(payments);
              }
              resolve();
         }, (error) => {
             console.error("Erro ao buscar pagamentos:", error);
             const tableBody = document.getElementById('payments-table-body');
             if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-500">Erro ao carregar lançamentos.</td></tr>`;
             reject(error);
         });
         setUnsubscribe('paymentsUnsubscribe', unsubscribe);
     });
}

export function fetchAndRenderRooms() {
     if (!currentUserClinicId) return Promise.reject("No clinic ID");
     const q = query(collection(db, "clinics", currentUserClinicId, "rooms"));

     if (roomsUnsubscribe) roomsUnsubscribe();
     return new Promise((resolve, reject) => {
         const unsubscribe = onSnapshot(q, (snapshot) => {
             const newRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
             setGlobalState({ clinicRooms: newRooms }); // Update global state
              
             const currentRoomsListDiv = document.getElementById('rooms-list');
             if(currentRoomsListDiv) Render.renderRoomsList(newRooms);
             resolve();
         }, (error) => {
             console.error("Erro ao buscar salas:", error);
              const currentRoomsListDiv = document.getElementById('rooms-list');
             if(currentRoomsListDiv) currentRoomsListDiv.innerHTML = '<p class="text-red-500">Erro ao carregar salas.</p>';
             reject(error);
         });
         setUnsubscribe('roomsUnsubscribe', unsubscribe);
     });
 }

export async function fetchAndRenderDashboardData() {
     if (!currentUserClinicId) return Promise.resolve();

     if (dashboardAppointmentsUnsubscribe) {
          dashboardAppointmentsUnsubscribe();
          setUnsubscribe('dashboardAppointmentsUnsubscribe', null);
      }

     const patientsCountEl = document.getElementById('active-patients-count');
     if (patientsCountEl) {
          const patientsCol = collection(db, "clinics", currentUserClinicId, "patients");
           try {
                const snapshot = await getDocs(patientsCol);
                const currentPatientsCountEl = document.getElementById('active-patients-count');
                if(currentPatientsCountEl) {
                    currentPatientsCountEl.textContent = snapshot.size;
                }
           } catch (error) {
                console.error("Error fetching patient count:", error)
           };
     }

     const todayAppointmentsEl = document.getElementById('today-appointments');
     if (todayAppointmentsEl) {
         const todayStr = Utils.getDateString(new Date());
         const appointmentsCol = collection(db, 'clinics', currentUserClinicId, 'appointments');
         const q = query(appointmentsCol, where('date', '==', todayStr));

         return new Promise((resolve, reject) => {
             const unsubscribe = onSnapshot(q, (snapshot) => {
                 const currentTodayAppointmentsEl = document.getElementById('today-appointments');
                 if(!currentTodayAppointmentsEl) {
                     if (unsubscribe) unsubscribe();
                     resolve();
                     return;
                 }

                 if(snapshot.empty) {
                     currentTodayAppointmentsEl.innerHTML = '<p class="text-gray-500">Nenhum agendamento para hoje.</p>';
                 } else {
                     const appointments = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                     appointments.sort((a, b) => a.time.localeCompare(b.time));

                     currentTodayAppointmentsEl.innerHTML = appointments.map(app => {
                         return `<div class="appointment-item p-2 bg-gray-100 rounded-md cursor-pointer" data-appointment-id="${app.id}">
                             <p class="font-semibold">${app.time} - ${app.patientName}</p>
                         </div>`
                     }).join('');
                 }
                 resolve();
             }, (error) => {
                  console.error("Error fetching today's appointments:", error);
                  const currentTodayAppointmentsEl = document.getElementById('today-appointments');
                  if(currentTodayAppointmentsEl) currentTodayAppointmentsEl.innerHTML = '<p class="text-red-500">Erro ao carregar agendamentos.</p>';
                  reject(error);
             });
             setUnsubscribe('dashboardAppointmentsUnsubscribe', unsubscribe);
         });
     } else {
         return Promise.resolve();
     }
 }


// --- AGENDA CONTROL ---
export function updateAgenda() {
     const agendaContentEl = document.getElementById('agenda-content');
     if (!currentUserClinicId || !agendaContentEl) return Promise.resolve();
     if (appointmentsUnsubscribe) appointmentsUnsubscribe();

     // Update view buttons UI
     ['daily', 'weekly', 'monthly'].forEach(view => {
         const btn = document.getElementById(`agenda-view-${view}`);
         if(btn) {
             btn.classList.remove('bg-blue-500', 'text-white');
             if(currentAgendaView === view) {
                 btn.classList.add('bg-blue-500', 'text-white');
             }
         }
     });

     const periodHeader = document.getElementById('period-header');
     let startDate, endDate;

     if (currentAgendaView === 'monthly') {
         periodHeader.textContent = `${currentDate.toLocaleString('pt-BR', { month: 'long' })} de ${currentDate.getFullYear()}`;
         startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
         endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
     } else if (currentAgendaView === 'weekly') {
         const startOfWeek = new Date(currentDate);
         startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
         const endOfWeek = new Date(startOfWeek);
         endOfWeek.setDate(startOfWeek.getDate() + 6);
         periodHeader.textContent = `${startOfWeek.toLocaleDateString('pt-BR')} - ${endOfWeek.toLocaleDateString('pt-BR')}`;
         startDate = startOfWeek;
         endDate = endOfWeek;
     } else { // daily
         periodHeader.textContent = currentDate.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
         startDate = currentDate;
         endDate = currentDate;
     }

     const appointmentsCol = collection(db, 'clinics', currentUserClinicId, 'appointments');
     const q = query(appointmentsCol, where('date', '>=', Utils.getDateString(startDate)), where('date', '<=', Utils.getDateString(endDate)));

     agendaContentEl.innerHTML = '<p class="text-center text-gray-500 py-8">Carregando agendamentos...</p>';


     return new Promise((resolve, reject) => {
         const unsubscribe = onSnapshot(q, (snapshot) => {
              const currentAgendaContentEl = document.getElementById('agenda-content');
              if (!currentAgendaContentEl) {
                   if(unsubscribe) unsubscribe();
                  resolve();
                  return;
              }

             const newAppointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
             setGlobalState({ currentAppointments: newAppointments }); // Update global state
              const searchInput = document.getElementById('search-appointment');
             Render.renderAgendaView(newAppointments, searchInput ? searchInput.value : '');
             resolve();
         }, (error) => {
             console.error("Erro ao buscar agendamentos:", error);
              const currentAgendaContentEl = document.getElementById('agenda-content');
              if (currentAgendaContentEl) {
                  currentAgendaContentEl.innerHTML = '<p class="text-center text-red-500 py-8">Erro ao carregar agendamentos.</p>';
              }
              reject(error);
         });
         setUnsubscribe('appointmentsUnsubscribe', unsubscribe);
     });
 }