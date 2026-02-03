const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function initializeRoles() {
  console.log('Inicializando roles de CampusHub...');
  
  const roles = {
    student: {
      name: 'student',
      permissions: {
        canCreateChannels: false,
        canDeleteMessages: false,
        canManageUsers: false,
        canSendAnnouncements: false
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    teacher: {
      name: 'teacher',
      permissions: {
        canCreateChannels: true,
        canDeleteMessages: true,
        canManageUsers: false,
        canSendAnnouncements: true
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    admin: {
      name: 'admin',
      permissions: {
        canCreateChannels: true,
        canDeleteMessages: true,
        canManageUsers: true,
        canSendAnnouncements: true
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }
  };
  
  for (const [roleId, roleData] of Object.entries(roles)) {
    await db.collection('roles').doc(roleId).set(roleData);
    console.log(`✅ Rol ${roleId} creado`);
  }
  
  console.log('\n✅ Roles inicializados correctamente');
  console.log('📊 Total roles creados: 3 (student, teacher, admin)');
}

initializeRoles()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error al inicializar roles:', error);
    process.exit(1);
  });