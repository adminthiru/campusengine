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

    // Flatten to { class, subject } pairs for this specific employee only
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

    // Also include subjects assigned directly via the Subjects module (Subject.teacher field)
    const directSubjects = await Subject.find({ school: req.user.school, teacher: employee._id });
    if (directSubjects.length > 0) {
      const subjectIds = directSubjects.map(s => s._id);
      const classesWithSubjects = await Class.find({
        school: req.user.school,
        subjects: { $in: subjectIds }
      }).select('name section subjects');

      for (const cls of classesWithSubjects) {
        for (const subj of directSubjects) {
          const inClass = cls.subjects.some(s => String(s) === String(subj._id));
          if (!inClass) continue;
          const alreadyExists = subjectTeacherAssignments.some(
            a => String(a.class._id) === String(cls._id) && String(a.subject._id) === String(subj._id)
          );
          if (!alreadyExists) {
            subjectTeacherAssignments.push({
              class: { _id: cls._id, name: cls.name, section: cls.section },
              subject: { _id: subj._id, name: subj.name, code: subj.code, color: subj.color }
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
