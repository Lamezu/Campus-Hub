/**
 * Seed script: creates one study group per institute department in Firestore.
 *
 * Usage:
 *   node scripts/seedDepartmentGroups.js
 *
 * Requirements:
 *   1. Place your Firebase service-account JSON at scripts/serviceAccount.json
 *      (download from Firebase Console → Project Settings → Service accounts)
 *   2. npm install firebase-admin  (run once, from repo root or scripts/)
 *
 * Behaviour:
 *   - Groups are created with isPrivate: true so only assigned members can see them.
 *   - The creator (createdBy) is set to 'system' — change to a real admin UID if needed.
 *   - Already-existing groups with the same name are skipped (idempotent).
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ── Department data ───────────────────────────────────────────────────────────
const DEPARTMENTS = [
  { name: 'Hostelería y Turismo', description: 'Departamento de Hostelería y Turismo', color: '#FF9500' },
  { name: 'Sanidad', description: 'Departamento de Sanidad', color: '#FF3B30' },
  { name: 'Informática y Comunicaciones', description: 'Departamento de Informática y Comunicaciones', color: '#007AFF' },
  { name: 'Actividades Físicas y Deportivas', description: 'Departamento de Actividades Físicas y Deportivas', color: '#34C759' },
  { name: 'Administración y Gestión', description: 'Departamento de Administración y Gestión', color: '#5856D6' },
  { name: 'Servicios Socioculturales', description: 'Departamento de Servicios Socioculturales', color: '#AF52DE' },
  { name: 'Energía y Agua', description: 'Departamento de Energía y Agua', color: '#5AC8FA' },
  { name: 'Madera, Mueble y Corcho', description: 'Departamento de Madera, Mueble y Corcho', color: '#A2845E' },
  { name: 'Seguridad y Medio Ambiente', description: 'Departamento de Seguridad y Medio Ambiente', color: '#FF2D55' },
  { name: 'Idiomas', description: 'Departamento de Idiomas', color: '#FF9F0A' },
  { name: 'FOL', description: 'Departamento de Formación y Orientación Laboral', color: '#32ADE6' },
  { name: 'Orientación', description: 'Departamento de Orientación', color: '#34C759' },
  { name: 'Innovación y Calidad', description: 'Departamento de Innovación y Calidad', color: '#FFCC00' },
].map(d => ({ ...d, subject: 'Departamentos', icon: 'building-2' }));

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  console.log(`Seeding ${DEPARTMENTS.length} department groups…\n`);

  // Fetch existing group names to skip duplicates
  const existing = await db.collection('studyGroups').get();
  const existingNames = new Set(existing.docs.map(d => d.data().name));

  let created = 0;
  let skipped = 0;

  for (const dept of DEPARTMENTS) {
    if (existingNames.has(dept.name)) {
      console.log(`  ⏭  Skipping "${dept.name}" (already exists)`);
      skipped++;
      continue;
    }

    await db.collection('studyGroups').add({
      name: dept.name,
      description: dept.description,
      subject: dept.subject,
      icon: dept.icon,
      color: dept.color,
      createdBy: 'system',
      createdByName: 'Sistema',
      memberIds: [],          // admin assigns members via app or Firestore console
      memberCount: 0,
      isPrivate: true,        // invisible until a member is added
      allowedRoles: [],       // no role restriction — admin assigns explicitly
      invitedUserIds: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`  ✅ Created "${dept.name}"`);
    created++;
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
