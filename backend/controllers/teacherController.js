const Employee = require('../models/Employee');
const Class = require('../models/Class');
const School = require('../models/School');
const Subject = require('../models/Subject');

const getMyProfile = async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id, school: req.user.school });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });

    const school = await School.findById(req.user.school);

    // Class where this employee is class teacher
    const classTeacherClass = await Class.findOne({ school: req.user.school, classTeacher: employee._id })
      .populate('subjects', 'name code color')
      .populate('subjectTeachers.subject', 'name code color');

    // Classes where this employee appears as a subject teacher (via Class.subjectTeachers)
    const subjectTeacherClasses = await Class.find({
      school: req.user.school,
      'subjectTeachers.teacher': employee._id
    }).populate('subjectTeachers.subject', 'name code color');

    // Flatten to { class, subject } pairs for this specific employee only.
    // Per-class `Class.subjectTeachers` is the authoritative source — so removing
    // a teacher from a class here removes their access to it. (We intentionally do
    // NOT expand the global `Subject.teacher` to every class that contains the
    // subject, which previously re-granted classes the admin had removed.)
    const subjectTeacherAssignments = [];
    for (const cls of subjectTeacherClasses) {
      for (const st of cls.subjectTeachers) {
        if (String(st.teacher) === String(employee._id)) {
          subjectTeacherAssignments.push({
            class: { _id: cls._id, name: cls.name, section: cls.section },
            subject: st.subject
          });
        }
      }
    }

    // Add subjects assigned to this teacher globally (Subjects module → Subject.teacher),
    // but ONLY within classes the teacher is actually connected to (their own class as
    // class teacher, or a class they already teach a subject in). This keeps global
    // assignments working for the teacher's classes, without re-granting classes the
    // admin removed them from (e.g. a class they don't belong to but which happens to
    // include the subject).
    const globalSubjects = await Subject.find({ school: req.user.school, teacher: employee._id });
    if (globalSubjects.length > 0) {
      const globalSubjMap = new Map(globalSubjects.map(s => [String(s._id), s]));
      const connectedClasses = await Class.find({
        school: req.user.school,
        $or: [{ classTeacher: employee._id }, { 'subjectTeachers.teacher': employee._id }],
      }).populate('subjects', 'name code color');
      for (const cls of connectedClasses) {
        for (const subj of (cls.subjects || [])) {
          if (!globalSubjMap.has(String(subj._id))) continue;
          const exists = subjectTeacherAssignments.some(
            a => String(a.class._id) === String(cls._id) && String(a.subject._id) === String(subj._id)
          );
          if (!exists) {
            subjectTeacherAssignments.push({
              class: { _id: cls._id, name: cls.name, section: cls.section },
              subject: { _id: subj._id, name: subj.name, code: subj.code, color: subj.color },
            });
          }
        }
      }
    }

    const isClassTeacher = !!classTeacherClass;
    const isSubjectTeacher = subjectTeacherAssignments.length > 0;

    res.json({
      success: true,
      employee: {
        _id: employee._id,
        name: employee.name,
        employeeId: employee.employeeId,
        designation: employee.designation,
        photo: employee.photo,
        department: employee.department
      },
      classTeacher: isClassTeacher ? {
        class: {
          _id: classTeacherClass._id,
          name: classTeacherClass.name,
          section: classTeacherClass.section,
          subjects: classTeacherClass.subjects
        }
      } : null,
      subjectTeacher: subjectTeacherAssignments,
      permissions: school?.teacherPermissions || {},
      isClassTeacher,
      isSubjectTeacher
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getMyProfile };
