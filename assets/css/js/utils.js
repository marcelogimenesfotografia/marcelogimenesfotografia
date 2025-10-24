import { loadingOverlay } from '../main.js';

// --- UI / MODAL UTILITIES ---

export function showLoading() { if(loadingOverlay) loadingOverlay.classList.remove('hidden'); }
export function hideLoading() { if(loadingOverlay) loadingOverlay.classList.add('hidden'); }

export function openModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
export function closeModal(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }

export function showConfirmation(title, text, onConfirm) {
    const confirmModal = document.getElementById('confirm-modal');
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-text').textContent = text;
    openModal(confirmModal);

    const confirmBtn = document.getElementById('confirm-modal-confirm');
    const cancelBtn = document.getElementById('confirm-modal-cancel');

    // Clone and replace buttons to remove previous listeners reliably
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const confirmHandler = () => { onConfirm(); closeModal(confirmModal); };
    const cancelHandler = () => { closeModal(confirmModal); };

    newConfirmBtn.addEventListener('click', confirmHandler, { once: true });
    newCancelBtn.addEventListener('click', cancelHandler, { once: true });
}

// --- DATA UTILITIES ---

// Helper to get YYYY-MM-DD string adjusted for local timezone
export function getDateString(date) {
    if (!date) return '';
    const d = new Date(date);
    // Adjust for timezone offset to get the correct local date string
    const adjustedDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
    return adjustedDate.toISOString().split('T')[0];
}

// Helper to construct full address string
export function constructPatientAddress(data) {
    if (!data) return '';
    const addressParts = [
        data.street || '',
        data.number ? `nº ${data.number}` : '',
        data.neighborhood || '',
        data.city || '',
        data.state || ''
    ];
    return addressParts.filter(Boolean).join(', ');
}

// Function to fetch address from CEP (ViaCEP)
export async function fetchAddressFromCEP(cep, formPrefix) {
    const cepClean = cep.replace(/\D/g, '');
    if (cepClean.length !== 8) {
        console.log("CEP inválido ou incompleto.");
        return;
    }

    // Find elements dynamically based on prefix
    const streetEl = document.getElementById(`${formPrefix}-street`);
    const neighborhoodEl = document.getElementById(`${formPrefix}-neighborhood`);
    const cityEl = document.getElementById(`${formPrefix}-city`);
    const stateEl = document.getElementById(`${formPrefix}-state`);
    const numberEl = document.getElementById(`${formPrefix}-number`);

    if (!streetEl || !neighborhoodEl || !cityEl || !stateEl) {
        console.error("Campos de endereço não encontrados no formulário:", formPrefix);
        return;
    }

    try {
        showLoading();
        const response = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`);
        if (!response.ok) throw new Error('CEP não encontrado');
        
        const data = await response.json();
        
        if (data.erro) {
            console.log("CEP não encontrado (ViaCEP).");
            streetEl.value = '';
            neighborhoodEl.value = '';
            cityEl.value = '';
            stateEl.value = '';
        } else {
            console.log("CEP encontrado:", data);
            streetEl.value = data.logradouro || '';
            neighborhoodEl.value = data.bairro || '';
            cityEl.value = data.localidade || '';
            stateEl.value = data.uf || '';
            
            if (numberEl) numberEl.focus();
        }
    } catch (error) {
        console.error("Erro ao buscar CEP:", error);
    } finally {
        hideLoading();
    }
}
```

### 5. `assets/js/modules/render.js` (Funções de Renderização)

Contém todas as funções que injetam HTML ou atualizam a interface do usuário (UI).

```javascript
import { setGlobalState, allPatients, clinicUsers, clinicRooms, currentAgendaView, currentDate, selectedPatientId, clinicPreferences } from '../main.js';
import * as Utils from './utils.js';
import * as Data from './data.js'; // To call specific data fetches for details

// --- SHARED ELEMENTS ---
const mainContentContainer = document.getElementById('main-content');
const patientDatalist = document.getElementById('patient-list');
const assessmentDetailModal = document.getElementById('assessment-detail-modal');


// --- PATIENT RENDERING ---

export function renderPatientList(patients) {
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
                        <p>${age} anos</p>
                        <p class="hidden sm:block">|</p>
                        <p>${patient.phone || 'Sem telefone'}</p>
                    </div>
                </div>
                <div class="mt-4 sm:mt-0 flex-shrink-0 flex space-x-2">
                    <button data-id="${patient.id}" class="view-details-btn bg-green-100 text-green-800 font-semibold p-2 rounded-lg hover:bg-green-200 transition" title="Avaliar / Ver Detalhes">
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

export function renderPatientDetails(patient) {
    const container = mainContentContainer.querySelector('#patient-info-container');
    if(!container) return;
    const age = patient.birthDate ? new Date().getFullYear() - new Date(patient.birthDate).getFullYear() : 'N/A';
    const fullAddress = Utils.constructPatientAddress(patient); 

    container.innerHTML = `
        <h2 class="text-3xl font-bold mb-2">${patient.name}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 text-gray-700">
            <p><strong>Idade:</strong> ${age} anos</p><p><strong>Sexo:</strong> ${patient.gender || 'Não informado'}</p><p><strong>CPF:</strong> ${patient.cpf || 'Não informado'}</p>
            <p><strong>Telefone:</strong> ${patient.phone || 'Não informado'}</p>
            <p class="md:col-span-2 lg:col-span-3"><strong>Endereço:</strong> ${fullAddress || 'Não informado'}</p>
            <p class="md:col-span-2 lg:col-span-3"><strong>Responsável/Cuidador:</strong> ${patient.caregiver || 'Não informado'}</p>
            <p class="md:col-span-2 lg:col-span-3"><strong>Observações:</strong> ${patient.observations || 'Não informado'}</p>
        </div>`;
}

export function renderAssessmentList(assessments) {
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
         const registeredBy = assessment.registeredByUserId ? (assessment.registeredByName || clinicUsers.find(u => u.id === assessment.registeredByUserId)?.email || 'Usuário Desconhecido') : 'N/A';

         let typeLabel = '';
         let tagClass = 'bg-gray-100 text-gray-800';
         if (assessment.type === 'initial') { typeLabel = 'Avaliação Inicial'; tagClass = 'bg-yellow-100 text-yellow-800'; }
         else if (assessment.type === 'evolution') { typeLabel = `Evolução (Sessão ${assessment.sessionNumber || 'N/A'})`; tagClass = 'bg-green-100 text-green-800'; }
         else if (assessment.type === 'discharge') { typeLabel = 'Alta Fisioterapêutica'; tagClass = 'bg-red-100 text-red-800'; }
         else { typeLabel = 'Registro Clínico'; }


         const card = document.createElement('div');
        card.className = `bg-gray-50 p-4 rounded-lg border border-gray-200`;
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-bold text-lg inline-block px-2 py-1 rounded-md text-sm ${tagClass}">${typeLabel}</p>
                    <p class="text-md font-semibold mt-1">Profissional: ${professionalName}</p>
                    ${assessment.registeredByUserId && assessment.registeredByUserId !== assessment.professionalId ? 
                        `<p class="text-sm text-gray-500">Cadastrado por: ${registeredBy}</p>` : ''}
                    <p class="text-sm text-gray-600">${assessmentDate}</p>
                </div>
                <button data-id="${assessment.id}" data-type="${assessment.type}" class="view-assessment-btn text-sm text-blue-600 hover:underline">Ver Detalhes</button>
            </div>
        `;
        container.appendChild(card);
    });
}

export function populateAssessmentDetailModal(data) {
    const orDefault = (value) => value || 'Não informado';
    
    // Esconder todas as abas
    assessmentDetailModal.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    assessmentDetailModal.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

    // Re-mostrar apenas o necessário para este tipo de registro
    assessmentDetailModal.querySelector(`[data-tab="detail-tab-discharge"]`).style.display = 'none'; // Default hidden

    if (data.type === 'evolution') {
        document.getElementById('detail-tab-evolution')?.classList.remove('hidden');
        assessmentDetailModal.querySelector('[data-tab="detail-tab-evolution"]')?.classList.add('active');
        document.getElementById('detail-evolution-session-number').textContent = orDefault(data.sessionNumber);
        document.getElementById('detail-evolution-date').textContent = data.date ? new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A';
        document.getElementById('detail-evolution-procedures').textContent = orDefault(data.procedures);
        document.getElementById('detail-evolution-response').textContent = orDefault(data.response);
        document.getElementById('detail-evolution-notes').textContent = orDefault(data.notes);

    } else if (data.type === 'discharge') {
         document.getElementById('detail-tab-discharge')?.classList.remove('hidden');
         assessmentDetailModal.querySelector('[data-tab="detail-tab-discharge"]')?.classList.add('active');
         assessmentDetailModal.querySelector(`[data-tab="detail-tab-discharge"]`).style.display = 'inline-flex'; // Show Alta tab

         document.getElementById('detail-discharge-date').textContent = data.date ? new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A';
         document.getElementById('detail-discharge-dor-eva').textContent = orDefault(data.dorEva);
         document.getElementById('detail-discharge-queixas-finais').textContent = orDefault(data.queixasFinais);
         document.getElementById('detail-discharge-marcha-equilibrio').textContent = orDefault(data.marchaEquilibrio);
         document.getElementById('detail-discharge-adm-forca').textContent = orDefault(data.admForca);
         document.getElementById('detail-discharge-funcionalidade').textContent = orDefault(data.funcionalidadeFinal);
         document.getElementById('detail-discharge-resultados').textContent = orDefault(data.resultados);
         document.getElementById('detail-discharge-motivo').textContent = orDefault(data.motivo);

    } else { // 'initial' ou outro formato completo
        document.getElementById('detail-tab1')?.classList.remove('hidden');
        assessmentDetailModal.querySelector('[data-tab="detail-tab1"]')?.classList.add('active');

        // Tab 1
        document.getElementById('detail-diagMedico').textContent = orDefault(data.diagMedico);
        document.getElementById('detail-comorbidades').textContent = orDefault(data.comorbidades);
        document.getElementById('detail-medicacoes').textContent = orDefault(data.medicacoes);
        document.getElementById('detail-cirurgias').textContent = orDefault(data.cirurgias);
        document.getElementById('detail-queixas').textContent = orDefault(data.queixas);
        document.getElementById('detail-dorEva').textContent = orDefault(data.dorEva);
        document.getElementById('detail-dorLocal').textContent = orDefault(data.dorLocal);
        document.getElementById('detail-habitos').textContent = orDefault(data.habitos);
        // Tab 2
        document.getElementById('detail-tab2')?.classList.remove('hidden');
        document.getElementById('detail-consciencia').textContent = orDefault(data.consciencia);
        document.getElementById('detail-orientacao').textContent = orDefault(data.orientacao);
        document.getElementById('detail-comunicacao').textContent = orDefault(data.comunicacao);
        // Tab 3
        document.getElementById('detail-tab3')?.classList.remove('hidden');
        document.getElementById('detail-postura').textContent = orDefault(data.postura);
        document.getElementById('detail-marcha').textContent = orDefault(data.marcha);
        document.getElementById('detail-equilibrio').textContent = orDefault(data.equilibrio);
        document.getElementById('detail-adm').textContent = orDefault(data.adm);
        document.getElementById('detail-forca').textContent = orDefault(data.forca);
        document.getElementById('detail-tonus').textContent = orDefault(data.tonus);
        document.getElementById('detail-coordenacao').textContent = orDefault(data.coordenacao);
        document.getElementById('detail-sensibilidade').textContent = orDefault(data.sensibilidade);
        document.getElementById('detail-edema').textContent = orDefault(data.edema);
        document.getElementById('detail-edemaLocal').textContent = orDefault(data.edemaLocal);
        document.getElementById('detail-testesRealizados').textContent = orDefault(data.testesRealizados);
        // Tab 4
        document.getElementById('detail-tab4')?.classList.remove('hidden');
        document.getElementById('detail-banho').textContent = orDefault(data.banho);
        document.getElementById('detail-vestir').textContent = orDefault(data.vestir);
        document.getElementById('detail-alimentacao').textContent = orDefault(data.alimentacao);
        document.getElementById('detail-continencia').textContent = orDefault(data.continencia);
        document.getElementById('detail-fraldas').textContent = orDefault(data.fraldas);
        document.getElementById('detail-transferencias').textContent = orDefault(data.transferencias);
        document.getElementById('detail-deambulacao').textContent = orDefault(data.deambulacao);
        // Tab 5
        document.getElementById('detail-tab5')?.classList.remove('hidden');
        document.getElementById('detail-residencia').textContent = orDefault(data.residencia);
        document.getElementById('detail-iluminacao').textContent = orDefault(data.iluminacao);
        document.getElementById('detail-espaco').textContent = orDefault(data.espaco);
        document.getElementById('detail-barreiras').textContent = data.barreiras && data.barreiras.length > 0 ? data.barreiras.join(', ') : 'Nenhuma';
         // Tab 6
         document.getElementById('detail-tab6')?.classList.remove('hidden');
        document.getElementById('detail-objetivos').textContent = orDefault(data.objetivos);
    }
}


// --- AGENDA RENDERING ---

export function renderAgendaView(appointments, searchTerm = '') {
    const agendaContentEl = mainContentContainer.querySelector('#agenda-content');
     if (!agendaContentEl) return;

    const filteredAppointments = searchTerm
        ? appointments.filter(app => app.patientName && app.patientName.toLowerCase().includes(searchTerm.toLowerCase()))
        : appointments;

    if (currentAgendaView === 'monthly') {
        renderMonthlyView(currentDate.getFullYear(), currentDate.getMonth(), filteredAppointments);
    } else if (currentAgendaView === 'weekly') {
        renderWeeklyView(currentDate, filteredAppointments);
    } else {
        renderDailyView(currentDate, filteredAppointments);
    }
}

function renderMonthlyView(year, month, appointments = []) {
    const agendaContent = mainContentContainer.querySelector('#agenda-content');
    if (!agendaContent) return;

    let contentHTML = `
        <div class="bg-white rounded-lg shadow-lg p-4">
            <div class="grid grid-cols-7 gap-px text-center font-semibold text-sm text-gray-600 mb-2">
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
            </div>
            <div id="calendar-grid" class="grid grid-cols-7 gap-px"></div>
        </div>`;
    agendaContent.innerHTML = contentHTML;

    const calendarGrid = agendaContent.querySelector('#calendar-grid');
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Add empty cells for days before the 1st
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarGrid.insertAdjacentHTML('beforeend', '<div></div>');
    }

    const today = new Date();
    const todayStr = Utils.getDateString(today);

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDayDate = new Date(year, month, day);
        const dateStr = Utils.getDateString(currentDayDate);
        const dayAppointments = appointments.filter(a => a.date === dateStr).sort((a,b) => a.time.localeCompare(b.time));

        let appointmentsHTML = dayAppointments.map(app => {
            const location = app.serviceType === 'domiciliar' ? 'Domiciliar' : (app.roomName || 'N/A');
            const title = `${app.time} - ${app.patientName}\nProf: ${app.professionalName || 'N/A'}\nLocal: ${location}`;
            return `<div class="appointment-item appointment-badge text-xs bg-blue-100 text-blue-800 p-1 rounded-md mb-1" data-appointment-id="${app.id}" title="${title}">
                ${app.time} - ${app.patientName}
            </div>`
        }).join('');

        const isToday = dateStr === todayStr;
        const dayClass = isToday ? 'bg-blue-100' : 'bg-gray-50 hover:bg-gray-100';

        calendarGrid.insertAdjacentHTML('beforeend', `
            <div class="calendar-day border p-2 ${dayClass} flex flex-col cursor-pointer" data-date="${dateStr}">
                <div class="font-bold text-gray-800">${day}</div>
                <div class="mt-1 flex-1 overflow-y-auto text-left">${appointmentsHTML}</div>
            </div>
        `);
    }
}


function renderWeeklyView(date, appointments = []) {
    const agendaContent = mainContentContainer.querySelector('#agenda-content');
     if (!agendaContent) return;
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    let tableHTML = `
        <div class="bg-white rounded-lg shadow-lg p-4 overflow-x-auto">
            <div class="grid grid-cols-7 text-center font-semibold text-sm text-gray-600 min-w-[700px]">`;

    const startOfWeek = new Date(date);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        tableHTML += `<div>${weekDays[i]} <span class="font-normal text-gray-500">${day.getDate()}</span></div>`;
    }
    tableHTML += `</div><div class="grid grid-cols-7 border-t border-l mt-2 min-w-[700px]">`;

    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        const dateStr = Utils.getDateString(day);
        const dayAppointments = appointments.filter(a => a.date === dateStr).sort((a,b) => a.time.localeCompare(b.time));

        let appointmentsHTML = dayAppointments.map(app => {
            const location = app.serviceType === 'domiciliar' ? 'Domiciliar' : (app.roomName || 'N/A');
            const title = `${app.time} - ${app.patientName}\nProf: ${app.professionalName || 'N/A'}\nLocal: ${location}`;
            return `<div class="appointment-item appointment-badge text-xs bg-blue-100 text-blue-800 p-1 rounded-md mb-1" data-appointment-id="${app.id}" title="${title}">
                ${app.time} - ${app.patientName}
            </div>`
        }).join('');

        tableHTML += `<div class="border-r border-b p-2 min-h-[200px] cursor-pointer" data-date="${dateStr}">${appointmentsHTML}</div>`;
    }

    tableHTML += `</div></div>`;
    agendaContent.innerHTML = tableHTML;
}


function renderDailyView(date, appointments = []) {
     const agendaContent = mainContentContainer.querySelector('#agenda-content');

      if (!agendaContent) return;
     let appointmentsHTML = '<p class="text-gray-500">Nenhum agendamento para este dia.</p>';
     const dateStr = Utils.getDateString(date);
     const dayAppointments = appointments.filter(a => a.date === dateStr).sort((a,b) => a.time.localeCompare(b.time));

     if (dayAppointments.length > 0) {
         appointmentsHTML = dayAppointments.map(app => {
            const location = app.serviceType === 'domiciliar' 
                ? `Domiciliar (${app.address || 'Endereço não informado'})`
                : `Sala: ${app.roomName || 'N/A'}`;
            return `<div class="appointment-item bg-blue-50 p-4 rounded-lg border border-blue-200 cursor-pointer" data-appointment-id="${app.id}">
                <p class="font-bold">${app.time} - ${app.patientName}</p>
                <p class="text-sm text-gray-600">Profissional: ${app.professionalName || 'N/A'}</p>
                <p class="text-sm text-gray-600">${location}</p>
                ${app.notes ? `<p class="text-sm text-gray-500 mt-2">Obs: ${app.notes}</p>` : ''}
            </div>`
         }).join('');
     }
     agendaContent.innerHTML = `<div class="bg-white rounded-lg shadow-lg p-4 space-y-4" data-date="${dateStr}">${appointmentsHTML}</div>`;
}


// --- CONFIGURATION RENDERING ---

export function renderClinicDataForDisplay(data) {
    const container = document.getElementById('clinic-data-display');
    if (!container) return;

    const orDefault = (value) => value || 'Não informado';
    const fullAddress = Utils.constructPatientAddress(data); 

    let html = '';
    if (data.accountType === 'pf') {
        html = `
            <p><strong class="detail-label">Nome:</strong> <span class="detail-value">${orDefault(data.name)}</span></p>
            <p><strong class="detail-label">E-mail:</strong> <span class="detail-value">${orDefault(data.ownerEmail)}</span></p>
            <p><strong class="detail-label">CPF:</strong> <span class="detail-value">${orDefault(data.cpf)}</span></p>
            <p><strong class="detail-label">RG:</strong> <span class="detail-value">${orDefault(data.rg)}</span></p>
            <p><strong class="detail-label">Data de Nascimento:</strong> <span class="detail-value">${orDefault(data.birthDate)}</span></p>
            <p><strong class="detail-label">CREFITO:</strong> <span class="detail-value">${orDefault(data.crefito)}</span></p>
            <p><strong class="detail-label">Telefone:</strong> <span class="detail-value">${orDefault(data.phone)}</span></p>
            <p class="md:col-span-2"><strong class="detail-label">Endereço:</strong> <span class="detail-value">${orDefault(fullAddress)}</span></p>
        `;
    } else { // pj
        html = `
            <p><strong class="detail-label">Razão Social:</strong> <span class="detail-value">${orDefault(data.name)}</span></p>
            <p><strong class="detail-label">E-mail de Contato:</strong> <span class="detail-value">${orDefault(data.ownerEmail)}</span></p>
            <p><strong class="detail-label">CNPJ:</strong> <span class="detail-value">${orDefault(data.cnpj)}</span></p>
            <p><strong class="detail-label">CREFITO da Clínica:</strong> <span class="detail-value">${orDefault(data.crefito)}</span></p>
            <p><strong class="detail-label">Telefone:</strong> <span class="detail-value">${orDefault(data.phone)}</span></p>
            <p class="md:col-span-2"><strong class="detail-label">Endereço:</strong> <span class="detail-value">${orDefault(fullAddress)}</span></p>
            <hr class="md:col-span-2 my-2"/>
            <div class="md:col-span-2"><p class="font-semibold text-gray-600">Responsável Técnico</p></div>
            <p><strong class="detail-label">Nome:</strong> <span class="detail-value">${orDefault(data.responsavelNome)}</span></p>
            <p><strong class="detail-label">CPF:</strong> <span class="detail-value">${orDefault(data.responsavelCpf)}</span></p>
            <p><strong class="detail-label">CREFITO:</strong> <span class="detail-value">${orDefault(data.responsavelCrefito)}</span></p>
        `;
    }
    container.innerHTML = html;
}

export function populateClinicEditModal(data) {
    const container = document.getElementById('clinic-edit-form-fields');
    if (!container) return;
    
    let html = '';
    if (data.accountType === 'pf') {
        html = `
            <input type="hidden" id="edit-accountType" value="pf">
            <div class_name="md:col-span-2">
                <label class="block text-sm font-medium">Nome Completo</label>
                <input id="edit-pf-name" type="text" value="${data.name || ''}" class="w-full p-2 border rounded-lg">
            </div>
            <div>
                <label class="block text-sm font-medium">Data de Nascimento</label>
                <input id="edit-pf-birthDate" type="date" value="${data.birthDate || ''}" class="w-full p-2 border rounded-lg">
            </div>
            <div>
                <label class="block text-sm font-medium">RG</label>
                <input id="edit-pf-rg" type="text" value="${data.rg || ''}" class="w-full p-2 border rounded-lg">
            </div>
            <div>
                <label class="block text-sm font-medium">CPF</label>
                <input id="edit-pf-cpf" type="text" value="${data.cpf || ''}" class="w-full p-2 border rounded-lg">
            </div>
            <div>
                <label class="block text-sm font-medium">CREFITO</label>
                <input id="edit-pf-crefito" type="text" value="${data.crefito || ''}" class="w-full p-2 border rounded-lg">
            </div>
            <!-- Campos de Endereço Separados para Edição PF -->
            <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-6 gap-4 border p-3 rounded-lg bg-gray-50">
                <div class="md:col-span-2"><input id="edit-pf-cep" type="text" placeholder="CEP" value="${data.cep || ''}" class="w-full p-2 border rounded-lg" data-form-prefix="edit-pf"></div>
                <div class="md:col-span-4"><input id="edit-pf-street" type="text" placeholder="Rua / Endereço" value="${data.street || ''}" class="w-full p-2 border rounded-lg"></div>
                <div class="md:col-span-2"><input id="edit-pf-number" type="text" placeholder="Número" value="${data.number || ''}" class="w-full p-2 border rounded-lg"></div>
                <div class="md:col-span-4"><input id="edit-pf-neighborhood" type="text" placeholder="Bairro" value="${data.neighborhood || ''}" class="w-full p-2 border rounded-lg"></div>
                <div class="md:col-span-3"><input id="edit-pf-city" type="text" placeholder="Cidade" value="${data.city || ''}" class="w-full p-2 border rounded-lg"></div>
                <div class="md:col-span-3"><input id="edit-pf-state" type="text" placeholder="Estado (UF)" value="${data.state || ''}" class="w-full p-2 border rounded-lg"></div>
            </div>
            <div>
                <label class="block text-sm font-medium">Telefone</label>
                <input id="edit-pf-phone" type="tel" value="${data.phone || ''}" class="w-full p-2 border rounded-lg">
            </div>
        `;
    } else { // pj
        html = `
            <input type="hidden" id="edit-accountType" value="pj">
            <div class="md:col-span-2">
                <label class="block text-sm font-medium">Razão Social</label>
                <input id="edit-pj-razaoSocial" type="text" value="${data.name || ''}" class="w-full p-2 border rounded-lg">
            </div>
            <div>
                <label class="block text-sm font-medium">CNPJ</label>
                <input id="edit-pj-cnpj" type="text" value="${data.cnpj || ''}" class="w-full p-2 border rounded-lg">
            </div>
            <div>
                <label class="block text-sm font-medium">CREFITO da Clínica</label>
                <input id="edit-pj-crefito" type="text" value="${data.crefito || ''}" class="w-full p-2 border rounded-lg">
            </div>
             <div class="md:col-span-2">
                 <label class="block text-sm font-medium">Telefone Comercial</label>
                <input id="edit-pj-phone" type="tel" value="${data.phone || ''}" class="w-full p-2 border rounded-lg">
            </div>
            <!-- Campos de Endereço Separados para Edição PJ -->
            <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-6 gap-4 border p-3 rounded-lg bg-gray-50">
                <div class="md:col-span-2"><input id="edit-pj-cep" type="text" placeholder="CEP" value="${data.cep || ''}" class="w-full p-2 border rounded-lg" data-form-prefix="edit-pj"></div>
                <div class="md:col-span-4"><input id="edit-pj-street" type="text" placeholder="Rua / Endereço" value="${data.street || ''}" class="w-full p-2 border rounded-lg"></div>
                <div class="md:col-span-2"><input id="edit-pj-number" type="text" placeholder="Número" value="${data.number || ''}" class="w-full p-2 border rounded-lg"></div>
                <div class="md:col-span-4"><input id="edit-pj-neighborhood" type="text" placeholder="Bairro" value="${data.neighborhood || ''}" class="w-full p-2 border rounded-lg"></div>
                <div class="md:col-span-3"><input id="edit-pj-city" type="text" placeholder="Cidade" value="${data.city || ''}" class="w-full p-2 border rounded-lg"></div>
                <div class="md:col-span-3"><input id="edit-pj-state" type="text" placeholder="Estado (UF)" value="${data.state || ''}" class="w-full p-2 border rounded-lg"></div>
            </div>
            <hr class="md:col-span-2 my-2"/>
            <div class="md:col-span-2"><p class="text-sm font-semibold text-gray-600">Dados do Responsável Técnico</p></div>
            <div class="md:col-span-2">
                <label class="block text-sm font-medium">Nome do Responsável</label>
                <input id="edit-pj-responsavel" type="text" value="${data.responsavelNome || ''}" class="w-full p-2 border rounded-lg">
            </div>
            <div>
                <label class="block text-sm font-medium">CPF do Responsável</label>
                <input id="edit-pj-responsavel-cpf" type="text" value="${data.responsavelCpf || ''}" class="w-full p-2 border rounded-lg">
            </div>
            <div>
                 <label class="block text-sm font-medium">CREFITO do Responsável</label>
                <input id="edit-pj-responsavel-crefito" type="text" value="${data.responsavelCrefito || ''}" class="w-full p-2 border rounded-lg">
            </div>
        `;
    }
    container.innerHTML = html;
}

export function renderAllPayments(payments) {
    const tableBody = mainContentContainer.querySelector('#payments-table-body');
    if (!tableBody) return;
    
    if (payments.length === 0) {
         tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-500">Nenhum lançamento financeiro encontrado.</td></tr>`;
         return;
    }

    tableBody.innerHTML = '';
    payments.forEach(payment => {
        const row = document.createElement('tr');
        row.className = 'bg-white border-b';

        const statusClass = payment.status === 'pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';

        row.innerHTML = `
            <td class="px-6 py-4">${new Date(payment.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
            <td class="px-6 py-4 font-medium text-gray-900">${payment.patientName}</td>
            <td class="px-6 py-4">R$ ${Number(payment.value).toFixed(2).replace('.',',')}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">${payment.status}</span>
            </td>
            <td class="px-6 py-4">
                 <button data-id="${payment.id}" class="edit-payment-btn text-blue-600 hover:underline">Editar</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

export function renderRoomsList(rooms) {
    const roomsListDiv = document.getElementById('rooms-list');
    if (!roomsListDiv) return;
    
    if (rooms.length === 0) {
        roomsListDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma sala de atendimento cadastrada.</p>';
        return;
    }

    rooms.sort((a, b) => a.name.localeCompare(b.name));

    roomsListDiv.innerHTML = '';
    rooms.forEach(room => {
        const roomDiv = document.createElement('div');
        roomDiv.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg border';
        roomDiv.innerHTML = `
            <div>
                <p class="font-semibold">${room.name}</p>
            </div>
            <div class="flex gap-2">
                <button data-id="${room.id}" data-name="${room.name}" class="edit-room-btn text-sm bg-yellow-100 text-yellow-700 font-semibold py-1 px-3 rounded-lg hover:bg-yellow-200">Editar</button>
                <button data-id="${room.id}" data-name="${room.name}" class="delete-room-btn text-sm bg-red-100 text-red-700 font-semibold py-1 px-3 rounded-lg hover:bg-red-200">Excluir</button>
            </div>
        `;
        roomsListDiv.appendChild(roomDiv);
    });
}

export function renderMembersList(users) {
    const currentMembersListDiv = document.getElementById('members-list');
     if (!currentMembersListDiv) return;

     currentMembersListDiv.innerHTML = '<div class="space-y-2"></div>';
     const list = currentMembersListDiv.querySelector('.space-y-2');
     
     if (users.length === 0) {
         list.innerHTML = '<p class="text-gray-500">Nenhum membro encontrado.</p>';
     } else {
         users.sort((a,b) => a.email.localeCompare(b.email)).forEach(member => {
             const memberId = member.id;
             // We need currentUserId here, but since render.js shouldn't access main.js directly, 
             // we'll rely on it being imported/available in the context where it's called (e.g., in Nav.switchView)
             // For now, let's assume currentUserId is passed or accessible for demo purposes if needed later.
             // If not passed, this logic is safer in the calling context. For now, let's use the main variable.
             
             // NOTE: For the sake of modularization, assume `currentUserId` and `currentUserRole` are passed
             // or accessible if needed. Since they are global in main.js and exported, we can import them here:
             // (Let's re-import all needed globals for safety, even if it adds verbosity)
             const isCurrentUser = memberId === localStorage.getItem('currentUserIdTemp'); // Hacky workaround for modularity demo
             const memberRole = member.role || 'Não definido'; // Ensure role exists
             const memberEmail = member.email || 'N/A';
             
             const memberDiv = document.createElement('div');
             memberDiv.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg border';
             memberDiv.innerHTML = `
                 <div>
                     <p class="font-semibold">${memberEmail} ${isCurrentUser ? '(Você)' : ''}</p>
                     <p class="text-sm text-gray-600 capitalize">${memberRole}</p>
                 </div>
                 <div class="flex gap-2">
                    ${(localStorage.getItem('currentUserRoleTemp') === 'admin' && !isCurrentUser) ? `
                    <button data-id="${memberId}" data-email="${memberEmail}" data-role="${memberRole}" class="change-role-btn text-sm bg-gray-200 text-gray-700 font-semibold py-1 px-3 rounded-lg hover:bg-gray-300">Alterar Função</button>
                    <button data-id="${memberId}" data-email="${memberEmail}" class="remove-member-btn text-sm bg-red-100 text-red-700 font-semibold py-1 px-3 rounded-lg hover:bg-red-200">Remover</button>
                    ` : ''}
                 </div>
             `;
             list.appendChild(memberDiv);
         });
     }
}

// --- DATALIST / SELECT POPULATION ---

export function populatePatientDatalist() {
    if (!patientDatalist) return;
    patientDatalist.innerHTML = '';
    allPatients.sort((a, b) => a.name.localeCompare(b.name)).forEach(patient => {
        const option = document.createElement('option');
        option.value = patient.name;
        option.dataset.id = patient.id;
        patientDatalist.appendChild(option);
    });
}

export function populateProfessionalSelects(users, targetSelectId) {
    const targetSelect = document.getElementById(targetSelectId);
    
    if (!targetSelect) return;

    const professionalUsers = users.filter(u => u.role === 'fisioterapeuta' || u.role === 'admin');

    let optionsHTML = professionalUsers.map(u => 
        `<option value="${u.id}" data-name="${u.name || u.email}">${u.name || u.email} (${u.role})</option>`
    ).join('');
    
    optionsHTML = '<option value="" disabled selected>Selecione um Profissional</option>' + optionsHTML;

    targetSelect.innerHTML = optionsHTML;
    
    // Preencher o profissional logado por padrão, se aplicável
    // NOTE: Need to rely on exported globals from main.js here
    const currentUserId = localStorage.getItem('currentUserIdTemp'); 
    const currentUserRole = localStorage.getItem('currentUserRoleTemp');
    const currentUserData = professionalUsers.find(u => u.id === currentUserId);
    
    if (currentUserData && (currentUserRole === 'fisioterapeuta' || currentUserRole === 'admin')) {
         targetSelect.value = currentUserId;
    } else if (currentUserRole === 'secretaria') {
        targetSelect.value = '';
    }
}