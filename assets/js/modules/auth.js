import { auth, db, serverTime, currentUserClinicId, currentUserId, currentUserRole, setGlobalState, switchView } from '../main.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, reauthenticateWithCredential, EmailAuthProvider, updatePassword, deleteApp, getAuth, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { doc, getDoc, setDoc, addDoc, collection, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import * as Utils from './utils.js';
import * as Data from './data.js';

// NOTE: Firebase config needs to be accessible for the secondary app instance (move to main.js)
const firebaseConfig = {
    apiKey: "AIzaSyB5DK7R3WGtKIUy_fMt8iNKBtz9wgdBxVs",
    authDomain: "fisioterapia-cee9d.firebaseapp.com",
    projectId: "fisioterapia-cee9d",
    storageBucket: "fisioterapia-cee9d.appspot.com",
    messagingSenderId: "551406348997",
    appId: "1:551406348997:web:7b21e0d90ebf4969955eac",
    measurementId: "G-RDGZ2MKLWK"
};


// --- AUTH HANDLERS ---

export function setupAuthFormListeners() {
    document.getElementById('show-register-btn')?.addEventListener('click', (e) => { 
        e.preventDefault(); 
        document.getElementById('login-container').classList.add('hidden'); 
        document.getElementById('register-container').classList.remove('hidden'); 
    });
    
    document.getElementById('show-login-btn')?.addEventListener('click', (e) => { 
        e.preventDefault(); 
        document.getElementById('register-container').classList.add('hidden'); 
        document.getElementById('login-container').classList.remove('hidden'); 
    });

    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('register-form')?.addEventListener('submit', handleRegistration);
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
}

export async function handleLogin(e) {
    e.preventDefault();
    document.getElementById('login-error').textContent = '';
    Utils.showLoading();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
    }
    catch(error) {
         document.getElementById('login-error').textContent = 'E-mail ou senha inválidos.';
         Utils.hideLoading();
    }
}

export async function handleRegistration(e) {
    e.preventDefault();
    const errorEl = document.getElementById('register-error');
    errorEl.textContent = '';
    Utils.showLoading();

    const accountType = document.querySelector('input[name="accountType"]:checked').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    let clinicData = { accountType, ownerEmail: email };
    let clinicNameForDisplay;

    if (accountType === 'pf') {
        clinicNameForDisplay = document.getElementById('pf-name').value;
        clinicData = {
            ...clinicData,
            name: clinicNameForDisplay,
            birthDate: document.getElementById('pf-birthDate').value,
            // ... (other PF fields)
            phone: document.getElementById('pf-phone').value,
            address: Utils.constructPatientAddress(clinicData)
        };
    } else { // pj
        clinicNameForDisplay = document.getElementById('pj-razaoSocial').value;
        clinicData = {
            ...clinicData,
            name: clinicNameForDisplay,
            // ... (other PJ fields)
            responsavelNome: document.getElementById('pj-responsavel').value,
            address: Utils.constructPatientAddress(clinicData)
        };
    }

    if (!clinicNameForDisplay) {
        errorEl.textContent = 'O nome (PF) ou Razão Social (PJ) é obrigatório.';
         Utils.hideLoading();
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        clinicData = {
            ...clinicData,
            ownerId: user.uid,
            members: [user.uid],
            roles: { [user.uid]: 'admin' },
            status: 'active',
            createdAt: serverTime()
        };

        const clinicDocRef = await addDoc(collection(db, 'clinics'), clinicData);

        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
            email: user.email,
            clinicId: clinicDocRef.id,
            role: 'admin',
            name: accountType === 'pf' ? clinicData.name : clinicData.responsavelNome,
            createdAt: serverTime()
        });
    } catch (error) {
        console.error("Erro no cadastro:", error);
        if (error.code === 'auth/email-already-in-use') {
            errorEl.textContent = 'Este e-mail já está em uso. Tente outro.';
        } else if (error.code === 'auth/weak-password'){
             errorEl.textContent = 'Senha muito fraca. Use pelo menos 6 caracteres.';
        } else {
            errorEl.textContent = 'Erro ao criar conta. Tente novamente.';
        }
         Utils.hideLoading();
    }
}

export async function handleLogout() {
     Utils.showLoading();
     Data.unsubscribeAll(); // Ensure all listeners are cleaned on logout
     signOut(auth).catch(error => {
         console.error("Logout error:", error);
         Utils.hideLoading();
     });
}

export async function handleForcePasswordChange(e) {
    e.preventDefault();
    const errorEl = document.getElementById('force-password-change-error');
    errorEl.textContent = '';
    Utils.showLoading();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;
    const user = auth.currentUser;

    if (newPassword !== confirmNewPassword) {
        errorEl.textContent = 'As novas senhas não coincidem.';
         Utils.hideLoading();
        return;
    }
    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
        errorEl.textContent = 'A senha deve ter no mínimo 8 caracteres e um número.';
         Utils.hideLoading();
        return;
    }

    if (user && user.email) {
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);

            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { mustChangePassword: false });

            Utils.closeModal(document.getElementById('force-password-change-modal'));
            location.reload();

        } catch (error) {
            console.error("Erro ao alterar senha:", error);
            if (error.code === 'auth/wrong-password') {
                errorEl.textContent = 'A senha temporária está incorreta.';
            } else {
                errorEl.textContent = 'Ocorreu um erro. Tente novamente.';
            }
             Utils.hideLoading();
        }
    } else {
         Utils.hideLoading();
    }
}

export async function handleCreateUser(e) {
    e.preventDefault();
    const feedbackEl = document.getElementById('create-user-feedback');
    feedbackEl.textContent = '';
    feedbackEl.className = 'text-sm mt-4 h-4';
    const email = document.getElementById('new-user-email').value;
    const role = document.getElementById('new-user-role').value;

    const tempPassword = 'Fisio@' + Math.random().toString(36).substring(2, 8);

    const secondaryAppName = 'createUserApp-' + Date.now();
    let secondaryApp;
    let secondaryAuth;
    try {
         // Use the Firebase config imported above
         secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
         secondaryAuth = getAuth(secondaryApp);
         Utils.showLoading();

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
        const user = userCredential.user;

        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
            email: user.email,
            clinicId: currentUserClinicId,
            role: role,
            mustChangePassword: true,
            createdAt: serverTime()
        });

        const clinicDocRef = doc(db, 'clinics', currentUserClinicId);
        await updateDoc(clinicDocRef, {
            members: arrayUnion(user.uid),
            [`roles.${user.uid}`]: role
        });

        feedbackEl.textContent = `Usuário criado! Senha temporária: ${tempPassword}`;
        feedbackEl.classList.add('text-green-600');
        e.target.reset();

    } catch (error) {
        console.error("Erro ao criar usuário:", error);
         if (error.code === 'auth/email-already-in-use') {
            feedbackEl.textContent = 'Este e-mail já está em uso.';
        } else {
            feedbackEl.textContent = 'Erro ao criar usuário.';
        }
        feedbackEl.classList.add('text-red-600');
    } finally {
         Utils.hideLoading();
        if (secondaryAuth) await signOut(secondaryAuth).catch(e => console.error("Falha ao deslogar app secundário", e));
        if (secondaryApp) await deleteApp(secondaryApp).catch(e => console.error("Falha ao deletar app secundário", e));
    }
}


// --- AUTH STATE CHANGE HANDLER ---

export async function handleAuthStateChange(user) {
    const authView = document.getElementById('auth-view');
    const dashboardView = document.getElementById('dashboard-view');
    
    if (user) {
        const loadUserProfileAndDashboard = async (retriesLeft = 5) => {
            const userDocRef = doc(db, 'users', user.uid);
            try {
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists() && userDocSnap.data().clinicId) {
                    const userData = userDocSnap.data();

                    const clinicDocRef = doc(db, 'clinics', userData.clinicId);
                    const clinicDocSnap = await getDoc(clinicDocRef);

                    if (!clinicDocSnap.exists() || clinicDocSnap.data().status === 'inactive') {
                        document.getElementById('login-error').textContent = 'Erro: Clínica não encontrada ou inativa.';
                        await signOut(auth);
                        Utils.hideLoading();
                        return;
                    }
                    
                    const clinicData = clinicDocSnap.data();
                    
                    if (userData.mustChangePassword) {
                        authView.classList.add('hidden');
                        dashboardView.classList.add('hidden');
                        Utils.hideLoading();
                        Utils.openModal(document.getElementById('force-password-change-modal'));
                        return;
                    }

                    // Set global state
                    setGlobalState({
                        currentUserClinicId: userData.clinicId,
                        currentUserRole: userData.role,
                        currentUserId: user.uid,
                        currentUserName: userData.name || user.email,
                        clinicPreferences: clinicData.preferences || { defaultAgendaView: 'monthly', defaultServiceType: 'local' },
                        initialDataLoaded: true
                    });
                    
                    // Temp storage for render.js logic complexity in modular demo
                    localStorage.setItem('currentUserIdTemp', user.uid);
                    localStorage.setItem('currentUserRoleTemp', userData.role);

                    document.getElementById('user-email').textContent = user.email;
                    document.getElementById('clinic-name-sidebar').textContent = clinicData.name;

                    Utils.showLoading();
                    await Promise.allSettled([
                         Data.fetchAndRenderMembers(),
                         Data.fetchAndRenderRooms(),
                         Data.fetchAndRenderPatients()
                     ]);

                    authView.classList.add('hidden');
                    dashboardView.classList.remove('hidden');
                    switchView('inicio'); // SwitchView handles hiding loading

                } else {
                    if (retriesLeft > 0) {
                        setTimeout(() => loadUserProfileAndDashboard(retriesLeft - 1), 1000);
                    } else {
                        document.getElementById('login-error').textContent = 'Erro ao carregar perfil. Verifique se o cadastro foi concluído ou contate o suporte.';
                        await signOut(auth);
                        Utils.hideLoading();
                    }
                }
            } catch (error) {
                 console.error("Error fetching user/clinic data:", error);
                  document.getElementById('login-error').textContent = 'Erro ao carregar dados. Tente novamente.';
                  await signOut(auth);
                  Utils.hideLoading();
            }
        };

        loadUserProfileAndDashboard();

    } else {
         // Clean up global state and listeners
         Data.unsubscribeAll();
         setGlobalState({
             currentUserClinicId: null,
             currentUserRole: null,
             currentUserId: null,
             currentUserName: null,
             selectedPatientId: null,
             allPatients: [],
             clinicUsers: [],
             clinicRooms: [],
             currentAppointments: [],
             initialDataLoaded: false
         });
         localStorage.removeItem('currentUserIdTemp');
         localStorage.removeItem('currentUserRoleTemp');


        dashboardView.classList.add('hidden');
        authView.classList.remove('hidden');
        document.getElementById('login-container').classList.remove('hidden');
        document.getElementById('register-container').classList.add('hidden');
        
        Utils.hideLoading();
    }
}