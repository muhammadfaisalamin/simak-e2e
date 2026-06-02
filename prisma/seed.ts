import bcrypt from 'bcryptjs';
import {
	DegreeStatus,
	Gender,
	Location,
	PrismaClient,
	Religion,
	RoleType,
	SemesterType,
	StatusRegister,
} from '../generated/prisma/client';

import prisma from '../lib/prisma';

async function main() {
	// Permission
	const permissionData = [
		{ pathname: 'periods', name: 'period', nama: 'periode' },
		{ pathname: 'permissions', name: 'permission', nama: 'hak akses' },
		{ pathname: 'roles', name: 'role', nama: 'role' },
		{ pathname: 'krsrules', name: 'krsrule', nama: 'pengaturan krs' },
		{ pathname: 'users', name: 'user', nama: 'pengguna' },
		{ pathname: 'lecturers', name: 'lecturer', nama: 'dosen' },
		{ pathname: 'students', name: 'student', nama: 'mahasiswa' },
		{ pathname: 'operators', name: 'operator', nama: 'operator' },
		{ pathname: 'positions', name: 'position', nama: 'jabatan' },
		{ pathname: 'majors', name: 'major', nama: 'program studi' },
		{
			pathname: 'reregistrations',
			name: 'reregistration',
			nama: 'herregistrasi',
		},
		{ pathname: 'curriculums', name: 'curruculum', nama: 'kurikulum' },
		{ pathname: 'courses', name: 'course', nama: 'mata kuliah' },
		{ pathname: 'rooms', name: 'room', nama: 'ruangan' },
		{ pathname: 'krs', name: 'krs', nama: 'krs' },
		{ pathname: 'schedules', name: 'schedule', nama: 'jadwal' },
		{ pathname: 'classes', name: 'class', nama: 'kelas' },
		{ pathname: 'khs', name: 'khs', nama: 'khs' },
		{ pathname: 'presences', name: 'presence', nama: 'presensi' },
		{ pathname: 'transcripts', name: 'transcript', nama: 'transkip' },
		{ pathname: 'events', name: 'event', nama: 'event' },
		{ pathname: 'announcements', name: 'announcements', nama: 'pengumuman' },
		{
			pathname: 'recapitulations',
			name: 'recapitulation',
			nama: 'rekapitulasi',
		},
	];
	const action = ['view', 'create', 'edit', 'delete'];
	for (const resource of permissionData) {
		for (const act of action) {
			await prisma.permission.create({
				data: {
					name: `${act}:${resource.pathname}`,
					description: `${act}:${resource.nama}`,
				},
			});
		}
	}

	const roleName = [
		'admin',
		'dosen',
		'perwalian akademik',
		'finance',
		'akademik',
		'mahasiswa',
	];

	for (const element of roleName) {
		await prisma.role.create({
			data: {
				name: element,
				description: element,
				roleType:
					(element === 'dosen' && 'LECTURER') ||
					(element === 'mahasiswa' && 'STUDENT') ||
					(element === 'perwalian akademik' && 'ADVISOR') ||
					(element === 'admin' && 'OPERATOR') ||
					(element === 'finance' && 'OPERATOR') ||
					((element === 'akademik' && 'OPERATOR') as RoleType),
			},
		});
	}

	const permissions = await prisma.permission.count();

	for (let i = 1; i <= permissions; i++) {
		await prisma.rolePermission.create({
			data: {
				roleId: 1,
				permissionId: i,
			},
		});
	}

	await prisma.operator.create({
		data: {
			name: 'super admin',
			department: 'admin',
			user: {
				create: {
					email: 'admin1@stmik.com',
					password: bcrypt.hashSync('admin', 10),
					roleId: 1,
					isStatus: true,
				},
			},
		},
	});

	await prisma.major.createMany({
		data: [
			{
				name: 'Sistem Informasi',
				numberCode: 1,
				stringCode: 'SI',
			},
			{
				name: 'Teknik Informatika',
				numberCode: 2,
				stringCode: 'TI',
			},
		],
	});

	await prisma.gradeComponent.createMany({
		data: [
			{ name: 'Absensi dan Aktivitas', acronym: 'absen' },
			{ name: 'Tugas Kelompok', acronym: 'kelompok' },
			{ name: 'Tugas Mandiri', acronym: 'mandiri' },
			{ name: 'Ujian Tengah Semester', acronym: 'UTS' },
			{ name: 'Ujian Akhir Semester', acronym: 'UAS' },
			{ name: 'Praktikum', acronym: 'praktik' },
			{ name: 'Report/ Laporan', acronym: 'laporan' },
			{ name: 'Presentasi Laporan', acronym: 'presentasi' },
			{ name: 'Kejelasan Permasalahan Penelitian', acronym: 'KPP' },
			{ name: 'Tinjauan Pustaka dan Landasan Teori', acronym: 'pustaka' },
			{ name: 'Kelengkapan Data', acronym: 'kelDa' },
			{ name: 'Instrumen Penelitian', acronym: 'Instrumen' },
			{ name: 'Metode Pengujian', acronym: 'metode uji' },
			{ name: 'Demonstrasi', acronym: 'demo' },
		],
	});

	await prisma.assessment.create({
		data: {
			name: 'REGULER',
			assessmentDetail: {
				create: [
					{
						percentage: 10,
						grade: {
							connect: {
								name: 'Absensi dan Aktivitas',
							},
						},
					},
					{
						percentage: 20,
						grade: {
							connect: {
								name: 'Tugas Mandiri',
							},
						},
					},
					{
						percentage: 10,
						grade: {
							connect: {
								name: 'Tugas Kelompok',
							},
						},
					},
					{
						percentage: 25,
						grade: {
							connect: {
								name: 'Ujian Tengah Semester',
							},
						},
					},
					{
						percentage: 35,
						grade: {
							connect: {
								name: 'Ujian Akhir Semester',
							},
						},
					},
				],
			},
		},
	});
	await prisma.assessment.create({
		data: {
			name: 'CASE METHOD',
			assessmentDetail: {
				create: [
					{
						percentage: 10,
						grade: {
							connect: {
								name: 'Absensi dan Aktivitas',
							},
						},
					},
					{
						percentage: 25,
						grade: {
							connect: {
								name: 'Tugas Mandiri',
							},
						},
					},
					{
						percentage: 20,
						grade: {
							connect: {
								name: 'Tugas Kelompok',
							},
						},
					},
					{
						percentage: 20,
						grade: {
							connect: {
								name: 'Ujian Tengah Semester',
							},
						},
					},
					{
						percentage: 25,
						grade: {
							connect: {
								name: 'Ujian Akhir Semester',
							},
						},
					},
				],
			},
		},
	});
	await prisma.assessment.create({
		data: {
			name: 'PRAKTIKUM',
			assessmentDetail: {
				create: [
					{
						percentage: 60,
						grade: {
							connect: {
								name: 'Praktikum',
							},
						},
					},
					{
						percentage: 20,
						grade: {
							connect: {
								name: 'Report/ Laporan',
							},
						},
					},
					{
						percentage: 20,
						grade: {
							connect: {
								name: 'Presentasi Laporan',
							},
						},
					},
				],
			},
		},
	});
	await prisma.assessment.create({
		data: {
			name: 'SEMINAR PROPOSAL',
			assessmentDetail: {
				create: [
					{
						percentage: 20,
						grade: {
							connect: {
								name: 'Kejelasan Permasalahan Penelitian',
							},
						},
					},
					{
						percentage: 15,
						grade: {
							connect: {
								name: 'Tinjauan Pustaka dan Landasan Teori',
							},
						},
					},
					{
						percentage: 15,
						grade: {
							connect: {
								name: 'Kelengkapan Data',
							},
						},
					},
					{
						percentage: 15,
						grade: {
							connect: {
								name: 'Instrumen Penelitian',
							},
						},
					},
					{
						percentage: 15,
						grade: {
							connect: {
								name: 'Metode Pengujian',
							},
						},
					},
					{
						percentage: 20,
						grade: {
							connect: {
								name: 'Presentasi Laporan',
							},
						},
					},
				],
			},
		},
	});
	await prisma.assessment.create({
		data: {
			name: 'TUGAS AKHIR',
			assessmentDetail: {
				create: [
					{
						percentage: 30,
						grade: {
							connect: {
								name: 'Report/ Laporan',
							},
						},
					},
					{
						percentage: 30,
						grade: {
							connect: {
								name: 'Presentasi Laporan',
							},
						},
					},
					{
						percentage: 40,
						grade: {
							connect: {
								name: 'Demonstrasi',
							},
						},
					},
				],
			},
		},
	});

	const kurikulumSI = await prisma.curriculum.create({
		data: {
			name: 'KURIKULUM SI',
			majorId: 1,
			startDate: new Date(),
			endDate: new Date(),
			isActive: true,
		},
	});
	const kurikulumTI = await prisma.curriculum.create({
		data: {
			name: 'KURIKULUM TI',
			majorId: 2,
			startDate: new Date(),
			endDate: new Date(),
			isActive: true,
		},
	});

	const courseSI = [
		{
			code: 'SB-ISI-007',
			name: 'Pengantar Teknologi Informasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [1],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-028',
			name: 'Pendidikan Kewarganegaraan dan Antikorupsi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [1],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-030',
			name: 'Bahasa Inggris',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [1],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-001',
			name: 'Konsep Sistem Informasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 2,
			smt: [1],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-014',
			name: 'Dasar Pemrograman',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [1],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ISI-029',
			name: 'Bahasa Indonesia',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [1],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISO-007',
			name: 'Human Resource Management',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [1],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-003',
			name: 'Konsep Basis Data',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [2],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-021',
			name: 'Etika Profesi dan Profesionalisme',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 2,
			smt: [2],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-026',
			name: 'Pendidikan Agama',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [2],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-002',
			name: 'Sistem Informasi Manajemen',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [2],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-005',
			name: 'Sistem Operasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [2],
			assessment: 'REGULER',
			predecessor: 'IKB-S012',
		},
		{
			code: 'SB-ISI-023',
			name: 'Statistika dan Probabilitas',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [2],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-027',
			name: 'Pendidikan Pancasila dan NKRI',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [2],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-004',
			name: 'Sistem Basis Data',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ISI-015',
			name: 'Transformasi Digital',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-020',
			name: 'Kepemimpinan dan Manajemen Organisasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: 'IBB-S001',
		},
		{
			code: 'SB-ISO-004',
			name: 'Computational Thinking',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: 'IKB-S034',
		},
		{
			code: 'SB-ISPB1-002',
			name: 'Pengantar Bisnis (PBMB)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISPS1-004',
			name: 'Analisis & Desain Proses Bisnis (Pemodelan Bisnis) (PSI)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [3],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ISI-006',
			name: 'Jaringan komputer',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ISI-016',
			name: 'Pemrograman Berbasis Objek',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISO-003',
			name: 'Komunikasi dan Negosiasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISPB2-001',
			name: 'Komunikasi Bisnis (PBMB)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISPS2-003',
			name: 'Sistem Penunjang Keputusan (PSI)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-010',
			name: 'Analisa dan Perancangan Sistem Informasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [4],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-018',
			name: 'Keamanan Jaringan',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [4],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISO-002',
			name: 'IOT (Internet of Things)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [4],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISO-008',
			name: 'Enterprise Architecture',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [4],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISPS2-005',
			name: 'Data Mining (PSI)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [4],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ISI-017',
			name: 'Pemrograman Berbasis Web',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 4,
			smt: [4],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ISI-022',
			name: 'Metodologi Penelitian dan Penulisan Ilmiah',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 2,
			smt: [4],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISO-005',
			name: 'User Experience/Interface',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [4],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISPS1-002',
			name: 'Teknologi & Administrator Basis Data (PSI)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [4],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-008',
			name: 'Manajemen Proyek Sistem Informasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [5],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ISI-011',
			name: 'Software Testing dan Quality Assurance',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 2,
			smt: [5],
			assessment: 'REGULER',
			predecessor: 'SKB-S020',
		},
		{
			code: 'SB-ISI-013',
			name: 'Audit Sistem Informasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [5],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISO-006',
			name: 'Pemrograman Aplikasi Bergerak',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [5],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ISPB1-003',
			name: 'Startup Digital (PBMB)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [5],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISPS1-001',
			name: 'Implementasi Perangkat Lunak (Deployment, Testing, Adoption) (PSI)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [5],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ISI-009',
			name: 'Proyek Perangkat lunak',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [5],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ISI-012',
			name: 'Tata Kelola Teknologi Informasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [5],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-019',
			name: 'Keamanan Sistem Informasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 2,
			smt: [5],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISO-009',
			name: 'Interaksi Manusia dan Komputer',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 2,
			smt: [5],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISPB2-006',
			name: 'E-Commerce(PBMB)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [5],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISPS2-006',
			name: 'Artificial Intelligence (PSI)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [5],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ISO-101',
			name: 'Big Data',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISO-103',
			name: 'Matematika Diskrit',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISO-105',
			name: 'Analitik dan Visualisasi Data',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISO-107',
			name: 'Cloud Computing',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: 'SKB-S029',
		},
		{
			code: 'SB-ISO-109',
			name: 'Kreatif Digital',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISO-001',
			name: 'Technopreneurship',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISO-102',
			name: 'Business Intelegence',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISO-104',
			name: 'Sistem Rekomendasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 2,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISO-106',
			name: 'Machine Learning',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ISO-108',
			name: 'E-Marketing',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ISI-025',
			name: 'Praktek Kerja Lapangan',
			isPKL: true,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [7],
			assessment: 'PRAKTIKUM',
			predecessor: '',
		},
		{
			code: 'SB-ISI-024',
			name: 'Tugas Akhir',
			isPKL: false,
			isSkripsi: true,
			courseType: 'WAJIB',
			sks: 6,
			smt: [8],
			assessment: 'TUGAS AKHIR',
			predecessor: '',
		},
	];
	const courseTI = [
		{
			code: 'SB-ITI-016',
			name: 'Pendidikan Kewarganegaraan dan Antikorupsi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [1],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-006',
			name: 'Algoritma Pemrograman',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [1],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-014',
			name: 'Pendidikan Agama',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [1],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-009',
			name: 'Pengenalan Pemrograman',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [1],
			assessment: 'CASE METHOD',
			predecessor: 'IKB-T004',
		},
		{
			code: 'SB-ITI-023',
			name: 'Statistika dan Probabilitas',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [1],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-002',
			name: 'Hukum dan Kebijakan Teknologi Informasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 2,
			smt: [1],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITO-004',
			name: 'Kalkulus',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [1],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-024',
			name: 'Logika Matematika',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [2],
			assessment: 'REGULER',
			predecessor: 'SKK-T010',
		},
		{
			code: 'SB-ITI-001',
			name: 'Etika dan Profesi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 2,
			smt: [2],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-017',
			name: 'Bahasa Indonesia',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [2],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-015',
			name: 'Pendidikan Pancasila dan NKRI',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [2],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITO-003',
			name: 'Aljabar Linier',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [2],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-005',
			name: 'Struktur Data',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [2],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-022',
			name: 'Basis Data',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [2],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ITI-029',
			name: 'Big Data',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-012',
			name: 'Jaringan Komputer',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITJN-006',
			name: 'Komunikasi Data (Konsentrasi JN)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITSC-001',
			name: 'Computer Vision (Konsentrasi SC)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-027',
			name: 'Kompleksitas Algoritma',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITO-002',
			name: 'Matematika Diskrit',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-018',
			name: 'Organisasi dan Arsitektur Komputer',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-021',
			name: 'Sistem Operasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-020',
			name: 'Human-Computer Interaction',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [3],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-007',
			name: 'Keamanan Data dan Informasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [4],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-025',
			name: 'Cloud Computing',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [4],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITSC-002',
			name: 'Expert System (Konsentrasi SC)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [4],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ITI-013',
			name: 'Pemrograman Berorientasi Objek',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [4],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ITO-001',
			name: 'Mikrokontroller',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [4],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ITI-010',
			name: 'Pembelajaran Mesin (Machine Learning)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [4],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ITI-011',
			name: 'Kecerdasan Buatan (AI)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [4],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ITSC-005',
			name: 'Sistem Penunjang Keputusan (Konsentrasi SC)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [4],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-032',
			name: 'Pengolahan Citra Digital',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [4],
			assessment: 'REGULER',
			predecessor: 'SKB-T016',
		},
		{
			code: 'SB-ITI-019',
			name: 'Komputasi Paralel dan Terdistribusi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [5],
			assessment: 'REGULER',
			predecessor: 'SKB-T024',
		},
		{
			code: 'SB-ITO-005',
			name: 'Technopreneurship',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [5],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-031',
			name: 'Internet of Things',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [5],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-033',
			name: 'Tata Tulis Ilmiah (Metodologi Penelitian)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 2,
			smt: [5],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-003',
			name: 'Manajemen Proyek Teknologi Informasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [5],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ITI-026',
			name: 'Pemrograman Berbasis Platform',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 4,
			smt: [5],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITSC-004',
			name: 'Data Mining (Konsentrasi JN)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [5],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ITI-008',
			name: 'Analisis dan Desain Perangkat Lunak',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [5],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITO-106',
			name: 'StartUp Digital',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITO-110',
			name: 'Studi Kelayakan Bisnis',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITO-109',
			name: 'Komunikasi Bisnis',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITO-108',
			name: 'E-Marketing',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITO-107',
			name: 'E-Commerce',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITO-101',
			name: 'Mobile Computing',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ITO-105',
			name: 'Kreatif Digital',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITI-004',
			name: 'Proyek Prangkat Lunak',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'CASE METHOD',
			predecessor: '',
		},
		{
			code: 'SB-ITO-102',
			name: 'Pengantar Teknologi Informasi',
			isPKL: false,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: '',
		},
		{
			code: 'SB-ITO-103',
			name: 'Grafika dan Animasi Komputer (Konsentrasi JN)',
			isPKL: false,
			isSkripsi: false,
			courseType: 'PILIHAN_KONSENTRASI',
			sks: 3,
			smt: [6],
			assessment: 'REGULER',
			predecessor: 'SKB-T027',
		},
		{
			code: 'SB-ITI-028',
			name: 'Praktek Kerja Lapangan',
			isPKL: true,
			isSkripsi: false,
			courseType: 'WAJIB',
			sks: 3,
			smt: [7],
			assessment: 'PRAKTIKUM',
			predecessor: '',
		},
		{
			code: 'SB-ITI-030',
			name: 'Tugas Akhir',
			isPKL: false,
			isSkripsi: true,
			courseType: 'WAJIB',
			sks: 6,
			smt: [8],
			assessment: 'TUGAS AKHIR',
			predecessor: '',
		},
	];

	for (const si of courseSI) {
		await prisma.course.create({
			data: {
				code: si.code,
				name: si.name,
				sks: si.sks,
				major: {
					connect: {
						id: 1,
					},
				},
				courseType: si.courseType,
				isPKL: si.isPKL,
				isSkripsi: si.isSkripsi,
				assessment: {
					connect: {
						name: si.assessment,
					},
				},
			},
		});
		await prisma.curriculumDetail.create({
			data: {
				curriculum: {
					connect: {
						id: kurikulumSI.id,
					},
				},
				course: {
					connect: {
						code: si.code,
					},
				},
				semester: si.smt.at(0),
			},
		});
	}
	await prisma.curriculumDetail.create({
		data: {
			curriculum: {
				connect: {
					id: kurikulumSI.id,
				},
			},
			course: {
				connect: {
					code: 'SB-ISI-024',
				},
			},
			semester: 7,
		},
	});

	for (const ti of courseTI) {
		await prisma.course.create({
			data: {
				code: ti.code,
				name: ti.name,
				sks: ti.sks,
				major: {
					connect: {
						id: 2,
					},
				},
				courseType: ti.courseType,
				isPKL: ti.isPKL,
				isSkripsi: ti.isSkripsi,
				assessment: {
					connect: {
						name: ti.assessment,
					},
				},
			},
		});
		await prisma.curriculumDetail.create({
			data: {
				curriculum: {
					connect: {
						id: kurikulumTI.id,
					},
				},
				course: {
					connect: {
						code: ti.code,
					},
				},
				semester: ti.smt.at(0),
			},
		});
	}
	await prisma.curriculumDetail.create({
		data: {
			curriculum: {
				connect: {
					id: kurikulumTI.id,
				},
			},
			course: {
				connect: {
					code: 'SB-ITI-030',
				},
			},
			semester: 7,
		},
	});

	const roomData = [
		{ name: '202', location: 'BJB', capacity: 30 },
		{ name: '204', location: 'BJB', capacity: 30 },
		{ name: '301', location: 'BJB', capacity: 30 },
		{ name: '302', location: 'BJB', capacity: 30 },
		{ name: 'S201', location: 'BJB', capacity: 30 },
		{ name: 'S202', location: 'BJB', capacity: 30 },
		{ name: 'S203', location: 'BJB', capacity: 30 },
		{ name: 'S204', location: 'BJB', capacity: 30 },
		{ name: 'S1', location: 'BJB', capacity: 30 },
		{ name: 'S2', location: 'BJB', capacity: 30 },
		{ name: 'D1', location: 'BJB', capacity: 30 },
	];

	for (const rooms of roomData) {
		await prisma.room.create({
			data: {
				name: rooms.name,
				location: rooms.location as Location,
				capacity: rooms.capacity,
			},
		});
	}

	const period = await prisma.period.create({
		data: {
			semesterType: 'GANJIL' as SemesterType,
			year: 2024,
			name: 'GANJIL 2024/2025',
			isActive: true,
		},
	});

	await prisma.reregister.create({
		data: {
			name: 'herregistrasi GANJIL 2024/2025',
			periodId: period.id,
			isReregisterActive: true,
		},
	});

	await prisma.position.createMany({
		data: [
			{ personName: 'Wakabid Surname', positionName: 'Wakabid Akademik' },
			{ personName: 'Kaprodi Surname, SI', positionName: 'Kaprodi SI' },
			{ personName: 'Kaprodi Surname, TI', positionName: 'Kaprodi TI' },
		],
	});

	for (let i = 1; i <= 15; i++) {
		await prisma.user.create({
			data: {
				email: `lecturer${i}@stmik.com`,
				password: bcrypt.hashSync(`lecturer`, 10),
				roleId: i <= 5 ? 3 : 2,
				isStatus: true,
				lecturer: {
					create: {
						npk: `110.0${i}`,
						nidn: `12340001${i}`,
						name: `Lecturer TSurname${i}`,
						frontTitle: i % 2 === 0 ? 'Dr.' : '',
						backTitle: i % 2 === 0 ? 'S.Kom, M.Sc' : 'M.Kom',
						degree: i % 2 === 0 ? DegreeStatus.S3 : DegreeStatus.S2,
						gender: i % 2 === 0 ? Gender.WANITA : Gender.PRIA,
						religion:
							(i > 10 && Religion.ISLAM) ||
							(i > 5 && Religion.KATOLIK) ||
							(i <= 5 && Religion.BUDDHA) ||
							Religion.KONGHUCU,
						majorId: 2,
						year: 2014,
					},
				},
			},
		});
	}
	for (let i = 16; i <= 30; i++) {
		await prisma.user.create({
			data: {
				email: `lecturer${i}@stmik.com`,
				password: bcrypt.hashSync(`lecturer`, 10),
				roleId: i <= 20 ? 3 : 2,
				isStatus: true,
				lecturer: {
					create: {
						npk: `110.0${i}`,
						nidn: `12340001${i}`,
						name: `Lecturer ISurname${i}`,
						frontTitle: i % 2 === 0 ? 'Dr.' : '',
						backTitle: i % 2 === 0 ? 'S.Kom, M.Sc' : 'M.Kom',
						degree: i % 2 === 0 ? DegreeStatus.S3 : DegreeStatus.S2,
						gender: i % 2 === 0 ? Gender.WANITA : Gender.PRIA,
						religion:
							(i > 10 && Religion.ISLAM) ||
							(i > 5 && Religion.KATOLIK) ||
							(i <= 5 && Religion.BUDDHA) ||
							Religion.KONGHUCU,
						majorId: 1,
						year: 2014,
					},
				},
			},
		});
	}

	const lecturerSI = await prisma.lecturer.findMany({
		where: {
			user: {
				roleId: 3,
			},
			majorId: 1,
		},
	});
	const lecturerTI = await prisma.lecturer.findMany({
		where: {
			user: {
				roleId: 3,
			},
			majorId: 2,
		},
	});

	const students = [];

	for (let i = 0; i <= 9; i++) {
		students.push({
			nim: `3101240${i % 2 ? 1 : 2}240${i}`,
			name: `Student Surname 24${i}`,
			year: 2024,
			religion: Religion.ISLAM,
			gender: i % 2 ? Gender.PRIA : Gender.WANITA,
			majorId: i % 2 ? 1 : 2,
			statusRegister: StatusRegister.BARU,
			lecturerId: i % 2 ? lecturerSI[0].id : lecturerTI[0].id,
		});
	}
	for (let i = 0; i <= 9; i++) {
		students.push({
			nim: `3101230${i % 2 ? 1 : 2}230${i}`,
			name: `Student Surname 23${i}`,
			year: 2023,
			religion: Religion.ISLAM,
			gender: i % 2 ? Gender.PRIA : Gender.WANITA,
			majorId: i % 2 ? 1 : 2,
			statusRegister: StatusRegister.BARU,
			lecturerId: i % 2 ? lecturerSI[1].id : lecturerTI[1].id,
		});
	}
	for (let i = 0; i <= 9; i++) {
		students.push({
			nim: `3101220${i % 2 ? 1 : 2}220${i}`,
			name: `Student Surname 22${i}`,
			year: 2022,
			religion: Religion.ISLAM,
			gender: i % 2 ? Gender.PRIA : Gender.WANITA,
			majorId: i % 2 ? 1 : 2,
			statusRegister: StatusRegister.BARU,
			lecturerId: i % 2 ? lecturerSI[2].id : lecturerTI[2].id,
		});
	}
	for (let i = 0; i <= 9; i++) {
		students.push({
			nim: `3101210${i % 2 ? 1 : 2}210${i}`,
			name: `Student Surname 21${i}`,
			year: 2021,
			religion: Religion.ISLAM,
			gender: i % 2 ? Gender.PRIA : Gender.WANITA,
			majorId: i % 2 ? 1 : 2,
			statusRegister: StatusRegister.BARU,
			lecturerId: i % 2 ? lecturerSI[3].id : lecturerTI[3].id,
		});
	}

	await prisma.student.createMany({
		data: students,
	});
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
