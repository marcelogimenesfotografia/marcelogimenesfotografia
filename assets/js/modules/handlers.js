import * as Utils from './utils.js';
import * as Data from './data.js';
import * as Render from './render.js';
import * as Auth from './auth.js';
import * as Nav from './navigation.js';
import { db, serverTime, currentUserClinicId, allPatients, currentUserId, currentUserName, selectedPatientId, clinicUsers, clinicRooms, setGlobalState } from '../main.js';
import { doc, getDoc, updateDoc, deleteDoc, collection, addDoc, arrayRemove, arrayUnion, deleteField, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- SHARED ELEMENTS ---
const patientModal = document.getElementById('patient-modal');
const assessmentModal = document.getElementById('assessment-modal');
const evolutionModal = document.getElementById('evolution-modal');
const dischargeModal = document.getElementById('discharge-modal');
const appointmentModal = document.getElementById('appointment-modal');
const financialRecordModal = document.getElementById('financial-record-modal');
const changeRoleModal = document.getElementById('change-role-modal');
const clinicEditModal = document.getElementById('clinic-edit-modal');
const roomModal = document.getElementById('room-modal');

// --- MODAL AND FORM UTILITIES ---

export function setupModalCloseListeners() {
    document.getElementById('cancel-patient-modal')?.addEventListener('click', () => Utils.closeModal(patientModal));
    patientModal?.addEventListener('click', (e) => { if (e.target === patientModal) Utils.closeModal(patientModal); });
    
    document.getElementById('cancel-assessment-modal')?.addEventListener('click', () => Utils.closeModal(assessmentModal));
    assessmentModal?.addEventListener('click', (e) => { if (e.target === assessmentModal) Utils.closeModal(assessmentModal); });

    document.getElementById('cancel-evolution-modal')?.addEventListener('click', () => Utils.closeModal(evolutionModal));
    evolutionModal?.addEventListener('click', (e) => { if (e.target === evolutionModal) Utils.closeModal(evolutionModal); });
    
    document.getElementById('cancel-discharge-modal')?.addEventListener('click', () => Utils.closeModal(dischargeModal));
    dischargeModal?.addEventListener('click', (e) => { if (e.target === dischargeModal) Utils.closeModal(dischargeModal); });

    document.getElementById('close-assessment-detail-modal')?.addEventListener('click', () => Utils.closeModal(document.getElementById('assessment-detail-modal')));
    document.getElementById('close-assessment-detail-modal-btn')?.addEventListener('click', () => Utils.closeModal(document.getElementById('assessment-detail-modal')));
    document.getElementById('assessment-detail-modal')?.addEventListener('click', (e) => { if (e.target === document.getElementById('assessment-detail-modal')) Utils.closeModal(document.getElementById('assessment-detail-modal')); });

    document.getElementById('cancel-appointment-modal')?.addEventListener('click', () => Utils.closeModal(appointmentModal));
    appointmentModal?.addEventListener('click', (e) => { if (e.target === appointmentModal) Utils.closeModal(appointmentModal); });

    document.getElementById('cancel-financial-modal')?.addEventListener('click', () => Utils.closeModal(financialRecordModal));
    financialRecordModal?.addEventListener('click', (e) => { if (e.target === financialRecordModal) Utils.closeModal(financialRecordModal); });

    document.getElementById('cancel-change-role-modal')?.addEventListener('click', () => Utils.closeModal(changeRoleModal));
    changeRoleModal?.addEventListener('click', (e) => { if (e.target === changeRoleModal) Utils.closeModal(changeRoleModal); });

    document.getElementById('cancel-clinic-edit-modal')?.addEventListener('click', () => Utils.closeModal(clinicEditModal));
    clinicEditModal?.addEventListener('click', (e) => { if (e.target === clinicEditModal) Utils.closeModal(clinicEditModal); });

    document.getElementById('cancel-room-modal')?.addEventListener('click', () => Utils.closeModal(roomModal));
    roomModal?.addEventListener('click', (e) => { if (e.target === roomModal) Utils.closeModal(roomModal); });
    
    // Setup form submissions
    document.getElementById('patient-form')?.addEventListener('submit', handlePatientForm);
    document.getElementById('assessment-form')?.addEventListener('submit', handleAssessmentForm);
    document.getElementById('evolution-form')?.addEventListener('submit', handleEvolutionForm);
    document.getElementById('discharge-form')?.addEventListener('submit', handleDischargeForm);
    document.getElementById('appointment-form')?.addEventListener('submit', handleAppointmentForm);
    document.getElementById('financial-record-form')?.addEventListener('submit', handleFinancialRecordForm);
    document.getElementById('room-form')?.addEventListener('submit', handleRoomForm);
    document.getElementById('change-role-form')?.addEventListener('submit', handleChangeRoleForm);
    document.getElementById('clinic-edit-form')?.addEventListener('submit', handleClinicEditForm);
    document.getElementById('force-password-change-form')?.addEventListener('submit', Auth.handleForcePasswordChange);
    document.getElementById('create-user-form')?.addEventListener('submit', Auth.handleCreateUser); // Moved to Auth.js but kept here for easy access if needed.
    
    // Tab switching for Assessment Modals (Ensure elements exist)
    assessmentModal?.querySelector('.flex-wrap')?.addEventListener('click', handleAssessmentTabClick);
    document.getElementById('assessment-detail-modal')?.querySelector('.flex-wrap')?.addEventListener('click', handleAssessmentTabClick);
    dischargeModal?.querySelector('.flex-wrap')?.addEventListener('click', handleAssessmentTabClick);
}

function handleAssessmentTabClick(e) {
    if(e.target.matches('.tab-button')) {
        const modal = e.currentTarget.closest('.fixed');
        const tabId = e.target.dataset.tab;
        modal.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        modal.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
        modal.querySelector(`#${tabId}`)?.classList.remove('hidden');
    }
}

// --- FORM ELEMENT LISTENERS (Outside form submission) ---
export function setupFormElementListeners() {
    // Conditional fields in Assessment Modal
    document.body.addEventListener('change', (e) => { 
        if (e.target.closest('#assessment-modal')) {
            if(e.target.id === 'dor-eva') {
                document.getElementById('dor-local-container')?.classList.toggle('hidden', e.target.value == 0);
            }
            if(e.target.id === 'edema') {
                document.getElementById('edema-local-container')?.classList.toggle('hidden', e.target.value === 'Não');
            }
        }
        
        // Listener para os radio buttons do tipo de atendimento
        if (e.target.matches('input[name="serviceType"]')) {
            toggleAppointmentFields(e.target.value);
        }
    });
    
    // CEP Autocomplete listener for patient/register/edit forms
    document.body.addEventListener('blur', (e) => {
        if (e.target.matches('[data-form-prefix][id$="-cep"]')) {
            const formPrefix = e.target.dataset.formPrefix;
            Utils.fetchAddressFromCEP(e.target.value, formPrefix);
        }
    }, true); // Use capture phase for reliability

    // Patient Datalist Logic
    document.getElementById('appointment-patient-input')?.addEventListener('input', handlePatientInput);
    document.getElementById('financial-patient-input')?.addEventListener('input', handlePatientInput);
    
    // Toggle PF/PJ form in registration
    document.querySelectorAll('input[name="accountType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isPf = e.target.value === 'pf';
            document.getElementById('pf-fields').classList.toggle('hidden', !isPf);
            document.getElementById('pj-fields').classList.toggle('hidden', isPf);
        });
    });
    
    // Mobile Menu
    document.getElementById('mobile-menu-btn')?.addEventListener('click', Nav.toggleMobileMenu);
    document.getElementById('mobile-menu-overlay')?.addEventListener('click', Nav.toggleMobileMenu);
}


// --- DEDICATED HANDLERS ---

// Shared handler for patient datalist inputs
function handlePatientInput(e) {
    const inputValue = e.target.value;
    const listId = e.target.getAttribute('list');
    const datalistElement = document.getElementById(listId);
    const hiddenIdInput = document.getElementById(e.target.id.replace('-input', '-id'));

    if (!hiddenIdInput || !datalistElement) return;

    hiddenIdInput.value = '';
    const options = datalistElement.options;
    for (let i = 0; i < options.length; i++) {
        if (options[i].value === inputValue) {
            hiddenIdInput.value = options[i].dataset.id;
             if (e.target.id === 'appointment-patient-input') {
                 const serviceType = document.querySelector('input[name="serviceType"]:checked')?.value;
                 if (serviceType === 'domiciliar') {
                     const patient = allPatients.find(p => p.id === hiddenIdInput.value);
                     // Prefill address fields if needed
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

// Function to control service type fields in appointment modal
export function toggleAppointmentFields(type) {
    const salaContainer = document.getElementById('sala-container');
    const domiciliarContainer = document.getElementById('domiciliar-container');
    const salaSelect = document.getElementById('appointment-room');
    
    const streetInput = document.getElementById('appointment-street');
    const numberInput = document.getElementById('appointment-number');
    const cityInput = document.getElementById('appointment-city');

    if (!salaContainer || !domiciliarContainer || !salaSelect || !streetInput || !numberInput || !cityInput) {
        console.error("Campos do modal de agendamento não encontrados!");
        return; 
    }
    
    if (type === 'local') {
        salaContainer.classList.remove('hidden');
        domiciliarContainer.classList.add('hidden');
        salaSelect.required = true;
        streetInput.required = false;
        numberInput.required = false;
        cityInput.required = false;
    } else { // 'domiciliar'
        salaContainer.classList.add('hidden');
        domiciliarContainer.classList.remove('hidden');
        salaSelect.required = false;
        streetInput.required = true;
        numberInput.required = true;
        cityInput.required = true;
        // Pre-fill logic is handled in handlePatientInput
    }
}


// --- FORM SUBMISSION HANDLERS ---

async function handlePatientForm(e) {
    e.preventDefault();
    const patientId = document.getElementById('patient-id').value;
    const patientData = {
        name: document.getElementById('patient-name').value, 
        cpf: document.getElementById('patient-cpf').value, 
        birthDate: document.getElementById('patient-birthDate').value,
        gender: document.getElementById('patient-gender').value, 
        phone: document.getElementById('patient-phone').value, 
        caregiver: document.getElementById('patient-caregiver').value, 
        observations: document.getElementById('patient-observations').value,
        // Salvar campos de endereço separados
        cep: document.getElementById('patient-cep').value,
        street: document.getElementById('patient-street').value,
        number: document.getElementById('patient-number').value,
        neighborhood: document.getElementById('patient-neighborhood').value,
        city: document.getElementById('patient-city').value,
        state: document.getElementById('patient-state').value,
    };
    patientData.address = Utils.constructPatientAddress(patientData);
    
    try {
        Utils.showLoading();
        if (patientId) {
            const patientDocRef = doc(db, 'clinics', currentUserClinicId, 'patients', patientId);
            await updateDoc(patientDocRef, patientData); // Use updateDoc for simplicity on edit form
        } else {
            patientData.createdAt = serverTime();
            const patientsCollection = collection(db, 'clinics', currentUserClinicId, 'patients');
            await addDoc(patientsCollection, patientData);
        }
        Utils.closeModal(patientModal);
    } catch (error) {
         console.error("Erro ao salvar paciente:", error);
         alert("Erro ao salvar paciente.");
    } finally {
         Utils.hideLoading();
    }
}

async function handleAssessmentForm(e) {
    e.preventDefault();
    if (!selectedPatientId) {
        alert("Nenhum paciente selecionado para adicionar avaliação.");
        return;
    }
    Utils.showLoading();
    
    const formEl = document.getElementById('assessment-form');
    const type = formEl.dataset.type || 'initial';
    const professionalSelect = document.getElementById('assessment-professional');
    const professionalId = professionalSelect.value;
    const selectedOption = professionalSelect.options[professionalSelect.selectedIndex];
    const professionalName = selectedOption.dataset.name || selectedOption.textContent.replace(/\s\(.*\)/, '');

    if (!professionalId) {
        alert("Por favor, selecione o profissional responsável pelo registro.");
        Utils.hideLoading();
        return;
    }


    const barreiras = Array.from(document.querySelectorAll('#assessment-modal input[name="barreiras"]:checked')).map(el => el.value);
    const assessmentData = {
        diagMedico: document.getElementById('diag-medico').value, comorbidades: document.getElementById('comorbidades').value, medicacoes: document.getElementById('medicacoes').value,
        cirurgias: document.getElementById('cirurgias').value, queixas: document.getElementById('queixas').value, dorEva: document.getElementById('dor-eva').value,
        dorLocal: document.getElementById('dor-local').value, habitos: document.getElementById('habitos').value,
        consciencia: document.getElementById('consciencia').value, orientacao: document.getElementById('orientacao').value, comunicacao: document.getElementById('comunicacao').value,
        postura: document.getElementById('postura').value, marcha: document.getElementById('marcha').value, equilibrio: document.getElementById('equilibrio').value, adm: document.getElementById('adm').value,
        forca: document.getElementById('forca').value, tonus: document.getElementById('tonus').value, coordenacao: document.getElementById('coordenacao').value, sensibilidade: document.getElementById('sensibilidade').value,
        edema: document.getElementById('edema').value, edemaLocal: document.getElementById('edema-local').value, testesRealizados: document.getElementById('testes-realizados').value,
        banho: document.querySelector('#assessment-modal input[name="banho"]:checked')?.value || '', vestir: document.querySelector('#assessment-modal input[name="vestir"]:checked')?.value || '',
        alimentacao: document.querySelector('#assessment-modal input[name="alimentacao"]:checked')?.value || '', continencia: document.querySelector('#assessment-modal input[name="continencia"]:checked')?.value || '',
        fraldas: document.querySelector('#assessment-modal input[name="fraldas"]:checked')?.value || '', transferencias: document.getElementById('transferencias').value, deambulacao: document.getElementById('deambulacao').value,
        residencia: document.querySelector('#assessment-modal input[name="residencia"]:checked')?.value || '', iluminacao: document.querySelector('#assessment-modal input[name="iluminacao"]:checked')?.value || '',
        espaco: document.querySelector('#assessment-modal input[name="espaco"]:checked')?.value || '', barreiras,

        objetivos: document.getElementById('objetivos').value,
        
        type: type,
        professionalId: professionalId,
        professionalName: professionalName,
        registeredByUserId: currentUserId,
        registeredByName: currentUserName,
        createdAt: serverTime(),
    };

     try {
        const assessmentsCol = collection(db, 'clinics', currentUserClinicId, 'patients', selectedPatientId, 'assessments');
        await addDoc(assessmentsCol, assessmentData);
        Utils.closeModal(assessmentModal);
     } catch (error) {
          console.error("Erro ao salvar avaliação inicial:", error);
         alert("Erro ao salvar avaliação inicial.");
     } finally {
          Utils.hideLoading();
     }
}

async function handleEvolutionForm(e) {
    e.preventDefault();
    if (!selectedPatientId) {
        alert("Nenhum paciente selecionado para adicionar evolução.");
        return;
    }
    Utils.showLoading();

    const professionalSelect = document.getElementById('evolution-professional');
    const professionalId = professionalSelect.value;
    const selectedOption = professionalSelect.options[professionalSelect.selectedIndex];
    const professionalName = selectedOption.dataset.name || selectedOption.textContent.replace(/\s\(.*\)/, '');

    if (!professionalId) {
        alert("Por favor, selecione o profissional responsável pelo registro.");
        Utils.hideLoading();
        return;
    }

    const evolutionData = {
        type: 'evolution',
        sessionNumber: parseInt(document.getElementById('evolution-session-number').value),
        date: document.getElementById('evolution-date').value,
        procedures: document.getElementById('evolution-procedures').value,
        response: document.getElementById('evolution-response').value,
        notes: document.getElementById('evolution-notes').value,
        
        professionalId: professionalId,
        professionalName: professionalName,
        registeredByUserId: currentUserId,
        registeredByName: currentUserName,
        createdAt: serverTime(),
    };

    try {
        const assessmentsCol = collection(db, 'clinics', currentUserClinicId, 'patients', selectedPatientId, 'assessments');
        await addDoc(assessmentsCol, evolutionData);
        Utils.closeModal(evolutionModal);
    } catch (error) {
        console.error("Erro ao salvar evolução:", error);
        alert("Erro ao salvar evolução.");
    } finally {
        Utils.hideLoading();
    }
}

async function handleDischargeForm(e) {
    e.preventDefault();
     if (!selectedPatientId) {
        alert("Nenhum paciente selecionado para dar alta.");
        return;
    }
    Utils.showLoading();

    const professionalSelect = document.getElementById('discharge-professional');
    const professionalId = professionalSelect.value;
    const selectedOption = professionalSelect.options[professionalSelect.selectedIndex];
    const professionalName = selectedOption.dataset.name || selectedOption.textContent.replace(/\s\(.*\)/, '');

    if (!professionalId) {
        alert("Por favor, selecione o profissional responsável pela alta.");
        Utils.hideLoading();
        return;
    }
    
    const dischargeData = {
        type: 'discharge',
        date: Utils.getDateString(new Date()),
        
        // Dados simplificados da Avaliação Final
        queixasFinais: document.getElementById('discharge-queixas-finais').value,
        dorEva: document.getElementById('discharge-dor-eva').value,
        marchaEquilibrio: document.getElementById('discharge-marcha-equilibrio').value,
        admForca: document.getElementById('discharge-adm-forca').value,
        funcionalidadeFinal: document.getElementById('discharge-funcionalidade').value,
        
        // Resultados da Alta
        resultados: document.getElementById('discharge-resultados').value,
        motivo: document.getElementById('discharge-motivo').value,
        
        professionalId: professionalId,
        professionalName: professionalName,
        registeredByUserId: currentUserId,
        registeredByName: currentUserName,
        createdAt: serverTime(),
    };

    try {
        const assessmentsCol = collection(db, 'clinics', currentUserClinicId, 'patients', selectedPatientId, 'assessments');
        await addDoc(assessmentsCol, dischargeData);
        Utils.closeModal(dischargeModal);
    } catch (error) {
        console.error("Erro ao registrar alta:", error);
        alert("Erro ao registrar alta.");
    } finally {
        Utils.hideLoading();
    }
}

async function handleAppointmentForm(e) {
    e.preventDefault();
    const appointmentId = document.getElementById('appointment-id').value;
    const patientInput = document.getElementById('appointment-patient-input');
    let patientId = document.getElementById('appointment-patient-id').value;
    const patientName = patientInput.value;

     // Validate Patient Selection from Datalist more robustly
    if (!patientId || !allPatients.some(p => p.id === patientId && p.name === patientName)) {
         const foundPatient = allPatients.find(p => p.name.toLowerCase() === patientName.toLowerCase());
         if (!foundPatient) {
             alert("Paciente inválido ou não encontrado na lista. Por favor, selecione um paciente válido.");
             return;
         }
         patientId = foundPatient.id;
    }

    const professionalSelect = document.getElementById('appointment-professional');
    const professionalId = professionalSelect.value;
    const professionalName = professionalSelect.options[professionalSelect.selectedIndex]?.text.replace(/\s\(.*\)/, '') || '';
    const serviceType = document.querySelector('input[name="serviceType"]:checked').value;

     if (!professionalId) {
         alert("Por favor, selecione um profissional.");
         return;
     }

    const appointmentData = {
        patientId, patientName, professionalId, professionalName,
        date: document.getElementById('appointment-date').value,
        time: document.getElementById('appointment-time').value,
        duration: document.getElementById('appointment-duration').value,
        notes: document.getElementById('appointment-notes').value,
        status: 'agendado',
        serviceType: serviceType,
    };

    if (serviceType === 'local') {
        appointmentData.roomId = document.getElementById('appointment-room').value;
        appointmentData.roomName = document.getElementById('appointment-room').options[document.getElementById('appointment-room').selectedIndex]?.text || '';
         if (!appointmentData.roomId) {
             alert("Por favor, selecione uma sala para atendimento local.");
             return;
         }
         appointmentData.addressDetails = deleteField();
         appointmentData.address = deleteField();
    } else { // domiciliar
         const addressDetails = {
            cep: document.getElementById('appointment-cep').value,
            street: document.getElementById('appointment-street').value,
            number: document.getElementById('appointment-number').value,
            neighborhood: document.getElementById('appointment-neighborhood').value,
            city: document.getElementById('appointment-city').value,
            state: document.getElementById('appointment-state').value,
        };
        
        if (!addressDetails.street || !addressDetails.number || !addressDetails.city) {
             alert("Por favor, preencha os campos de endereço (Rua, Número, Cidade) para atendimento domiciliar.");
             return;
        }
        
         appointmentData.addressDetails = addressDetails;
         appointmentData.address = Utils.constructPatientAddress(addressDetails);
         appointmentData.roomId = deleteField();
         appointmentData.roomName = 'Domiciliar';
    }


    const appointmentsCol = collection(db, 'clinics', currentUserClinicId, 'appointments');

    try {
        Utils.showLoading();
        if (appointmentId) {
            const appointmentDocRef = doc(appointmentsCol, appointmentId);
            await updateDoc(appointmentDocRef, appointmentData);
        } else {
            appointmentData.createdAt = serverTime();
            await addDoc(appointmentsCol, appointmentData);
        }
        Utils.closeModal(appointmentModal);
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        alert("Erro ao salvar agendamento. Tente novamente.");
    } finally {
         Utils.hideLoading();
    }
}

async function handleFinancialRecordForm(e) {
    e.preventDefault();
     const patientInput = document.getElementById('financial-patient-input');
     let patientId = document.getElementById('financial-patient-id').value;
     const patientName = patientInput.value;
     const recordId = document.getElementById('financial-record-id').value;

      if (!patientId || !allPatients.some(p => p.id === patientId && p.name === patientName)) {
         const foundPatient = allPatients.find(p => p.name.toLowerCase() === patientName.toLowerCase());
         if (!foundPatient) {
             alert("Paciente inválido ou não encontrado na lista. Por favor, selecione um paciente válido.");
             return;
         }
         patientId = foundPatient.id;
     }

     const paymentData = {
         patientId, patientName,
         date: document.getElementById('financial-date').value,
         value: document.getElementById('financial-value').value,
         status: document.getElementById('financial-status').value,
         description: document.getElementById('financial-description').value,
     };

     const paymentsCol = collection(db, 'clinics', currentUserClinicId, 'payments');

     try {
         Utils.showLoading();
         if (recordId) {
             // Future: Implement update here
         } else {
            paymentData.createdAt = serverTime();
            await addDoc(paymentsCol, paymentData);
         }
         Utils.closeModal(financialRecordModal);
     } catch (error) {
          console.error("Erro ao salvar lançamento financeiro:", error);
          alert("Erro ao salvar lançamento. Tente novamente.");
     } finally {
         Utils.hideLoading();
     }
}

async function handleRoomForm(e) {
    e.preventDefault();
    const roomId = document.getElementById('room-id').value;
    const roomName = document.getElementById('room-name').value;

    if (!roomName) return;

    const roomData = { name: roomName };
    const roomsCol = collection(db, 'clinics', currentUserClinicId, 'rooms');

    try {
        Utils.showLoading();
        if (roomId) {
            const roomDocRef = doc(roomsCol, roomId);
            await updateDoc(roomDocRef, roomData);
        } else {
            roomData.createdAt = serverTime();
            await addDoc(roomsCol, roomData);
        }
        Utils.closeModal(roomModal);
    } catch (error) {
        console.error("Erro ao salvar sala:", error);
        alert("Erro ao salvar sala. Tente novamente.");
    } finally {
        Utils.hideLoading();
    }
}

async function handleChangeRoleForm(e) {
    e.preventDefault();
    const userIdToChange = document.getElementById('change-role-user-id').value;
    const newRole = document.getElementById('change-role-select').value;

    const userDocRef = doc(db, 'users', userIdToChange);
    const clinicDocRef = doc(db, 'clinics', currentUserClinicId);

    try {
        Utils.showLoading();
        await updateDoc(userDocRef, { role: newRole });
        await updateDoc(clinicDocRef, { [`roles.${userIdToChange}`]: newRole });
        Utils.closeModal(changeRoleModal);
    } catch(error) {
         console.error("Erro ao alterar função:", error);
         alert("Erro ao alterar função. Tente novamente.");
    } finally {
        Utils.hideLoading();
    }
}

async function handleClinicEditForm(e) {
    e.preventDefault();
    let updatedData = {};
    const accountType = document.getElementById('edit-accountType').value;

    if (accountType === 'pf') {
        updatedData = {
            name: document.getElementById('edit-pf-name').value,
            birthDate: document.getElementById('edit-pf-birthDate').value,
            rg: document.getElementById('edit-pf-rg').value,
            cpf: document.getElementById('edit-pf-cpf').value,
            crefito: document.getElementById('edit-pf-crefito').value,
            phone: document.getElementById('edit-pf-phone').value,
            cep: document.getElementById('edit-pf-cep').value,
            street: document.getElementById('edit-pf-street').value,
            number: document.getElementById('edit-pf-number').value,
            neighborhood: document.getElementById('edit-pf-neighborhood').value,
            city: document.getElementById('edit-pf-city').value,
            state: document.getElementById('edit-pf-state').value,
        };
         updatedData.address = Utils.constructPatientAddress(updatedData);
         if (updatedData.name) { // Update name in current user profile too
             await updateDoc(doc(db, 'users', currentUserId), { name: updatedData.name });
         }
    } else { // pj
        updatedData = {
            name: document.getElementById('edit-pj-razaoSocial').value,
            cnpj: document.getElementById('edit-pj-cnpj').value,
            crefito: document.getElementById('edit-pj-crefito').value,
            phone: document.getElementById('edit-pj-phone').value,
            responsavelNome: document.getElementById('edit-pj-responsavel').value,
            responsavelCpf: document.getElementById('edit-pj-responsavel-cpf').value,
            responsavelCrefito: document.getElementById('edit-pj-responsavel-crefito').value,
            cep: document.getElementById('edit-pj-cep').value,
            street: document.getElementById('edit-pj-street').value,
            number: document.getElementById('edit-pj-number').value,
            neighborhood: document.getElementById('edit-pj-neighborhood').value,
            city: document.getElementById('edit-pj-city').value,
            state: document.getElementById('edit-pj-state').value,
        };
        updatedData.address = Utils.constructPatientAddress(updatedData);
        if (updatedData.responsavelNome) { // Update responsible name in current user profile too
             await updateDoc(doc(db, 'users', currentUserId), { name: updatedData.responsavelNome });
         }
    }

    try {
        Utils.showLoading();
        const clinicDocRef = doc(db, 'clinics', currentUserClinicId);
        await updateDoc(clinicDocRef, updatedData);
        document.getElementById('clinic-name-sidebar').textContent = updatedData.name || 'FisioGestão'; // Update sidebar display
        Utils.closeModal(clinicEditModal);
    } catch (error) {
        console.error("Erro ao atualizar dados da clínica:", error);
        alert("Erro ao atualizar dados da clínica. Tente novamente.");
    } finally {
        Utils.hideLoading();
    }
}

async function handleSavePreferences() {
    const newDefaultView = document.getElementById('default-agenda-view').value;
    const newDefaultServiceType = document.getElementById('default-service-type').value;
    const clinicDocRef = doc(db, 'clinics', currentUserClinicId);
    try {
        Utils.showLoading();
        await updateDoc(clinicDocRef, {
            'preferences.defaultAgendaView': newDefaultView,
            'preferences.defaultServiceType': newDefaultServiceType
        });
        setGlobalState({ clinicPreferences: { defaultAgendaView: newDefaultView, defaultServiceType: newDefaultServiceType } });
        alert('Preferências salvas!');
    } catch (error) {
        console.error("Erro ao salvar preferências:", error);
        alert("Erro ao salvar preferências.");
    } finally {
         Utils.hideLoading();
    }
}


// --- GLOBAL CLICK DELEGATION ---

export function handleGlobalClick(e) {
    if (!currentUserClinicId && !e.target.closest('#force-password-change-form')) return;

    const target = e.target;
    
    // --- AGENDA ACTIONS ---
    if (target.closest('.appointment-item[data-appointment-id]')) {
        e.stopPropagation();
        const appointmentId = target.closest('.appointment-item').dataset.appointmentId;
        Nav.openAppointmentDetailModal(appointmentId);
    } else if (target.closest('.calendar-day[data-date]') || target.closest('#agenda-content[data-date]') && !target.closest('.appointment-item')) {
        const dateElement = target.closest('[data-date]');
        if (dateElement && dateElement.dataset.date) {
           const date = dateElement.dataset.date;
           Nav.openAppointmentDetailModal(null, date);
        }
    } else if (target.closest('#quick-add-appointment-btn')) {
         Nav.openAppointmentDetailModal(null, Utils.getDateString(new Date()));
    } else if (target.closest('#add-appointment-agenda-btn')) {
       const defaultDate = (Nav.getCurrentAgendaView() === 'daily') ? Utils.getDateString(Nav.getCurrentDate()) : Utils.getDateString(new Date());
       Nav.openAppointmentDetailModal(null, defaultDate);
    } else if (target.closest('#delete-appointment-btn')) {
        const appointmentId = document.getElementById('appointment-id').value;
        if (appointmentId) {
           Utils.showConfirmation('Excluir Agendamento', 'Tem certeza que deseja excluir este agendamento?', async () => {
                Utils.showLoading();
               try {
                   await deleteDoc(doc(db, 'clinics', currentUserClinicId, 'appointments', appointmentId));
                   Utils.closeModal(appointmentModal);
               } catch (error) {
                   console.error("Erro ao excluir agendamento:", error);
                   alert("Erro ao excluir agendamento.");
               } finally {
                    Utils.hideLoading();
               }
           });
        }
    }
    // --- PATIENT LIST ACTIONS ---
     else if (target.closest('.view-details-btn')) {
        const patientId = target.closest('.view-details-btn').dataset.id;
        Nav.handleViewDetails(patientId);
    } else if (target.closest('.edit-patient-btn')) {
        Nav.handleEditPatient(target.closest('.edit-patient-btn').dataset.id);
    } else if (target.closest('.delete-patient-btn')) {
        const patientId = target.closest('.delete-patient-btn').dataset.id;
        Utils.showConfirmation('Excluir Paciente', 'Isso excluirá o paciente e todas as suas avaliações. Continuar?', () => {
            const patientDocRef = doc(db, 'clinics', currentUserClinicId, 'patients', patientId);
            deleteDoc(patientDocRef).catch(error => console.error("Erro ao excluir paciente:", error));
        });
    } else if (target.closest('#add-patient-btn') || target.closest('#quick-add-patient-btn')) {
        Nav.handleNewPatient();
    }
    // --- PATIENT DETAIL ACTIONS ---
    else if (target.closest('#back-to-list-btn')) {
        Nav.handleBackToList();
    } else if (target.closest('#add-initial-assessment-btn')) {
         if(!selectedPatientId) return;
         Nav.openAssessmentModal('initial'); 
    } else if (target.closest('#add-evolution-btn')) {
         if(!selectedPatientId) return;
         Nav.openEvolutionModal();
    } else if (target.closest('#add-discharge-btn')) {
         if(!selectedPatientId) return;
         Nav.openDischargeModal();
    } else if (target.closest('.view-assessment-btn')) {
        if(!selectedPatientId) return;
        const assessmentId = target.closest('.view-assessment-btn').dataset.id;
        Nav.handleViewAssessmentDetails(assessmentId);
    }
    // --- SETTINGS ACTIONS ---
    else if (target.closest('.change-role-btn')) {
        document.getElementById('change-role-user-id').value = target.closest('.change-role-btn').dataset.id;
        document.getElementById('change-role-user-email').textContent = target.closest('.change-role-btn').dataset.email;
        document.getElementById('change-role-select').value = target.closest('.change-role-btn').dataset.role;
        Utils.openModal(changeRoleModal);
    } else if (target.closest('.remove-member-btn')) {
        Nav.handleRemoveMember(target.closest('.remove-member-btn').dataset.id, target.closest('.remove-member-btn').dataset.email);
    } else if (target.closest('#edit-clinic-data-btn')) {
        Nav.handleEditClinicData();
    } else if (target.closest('#add-payment-btn')) {
         Nav.handleNewPayment();
    } else if (target.closest('#add-room-btn')) {
        Nav.handleNewRoom();
    } else if (target.closest('.edit-room-btn')) {
        Nav.handleEditRoom(target.closest('.edit-room-btn').dataset.id, target.closest('.edit-room-btn').dataset.name);
    } else if (target.closest('.delete-room-btn')) {
        Nav.handleDeleteRoom(target.closest('.delete-room-btn').dataset.id, target.closest('.delete-room-btn').dataset.name);
    } else if (target.closest('#save-preferences-btn')) {
        handleSavePreferences();
    } else if (target.matches('#search-patient')) {
         target.addEventListener('input', handlePatientSearch, {once: true});
    }
}

function handlePatientSearch(e) {
     const searchTerm = e.target.value.toLowerCase();
     const filteredPatients = allPatients.filter(p => p.name.toLowerCase().includes(searchTerm));
     Render.renderPatientList(filteredPatients);
     // Re-attach listener for next input
     e.target.addEventListener('input', handlePatientSearch, {once: true});
}