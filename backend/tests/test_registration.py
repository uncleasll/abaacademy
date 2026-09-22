import unittest
import test_teacher_auth as auth_tests


class RegistrationTest(unittest.TestCase):
    setUpClass = classmethod(auth_tests.TeacherAuthTest.setUpClass.__func__)
    tearDownClass = classmethod(auth_tests.TeacherAuthTest.tearDownClass.__func__)
    start_server = classmethod(auth_tests.TeacherAuthTest.start_server.__func__)
    call = classmethod(auth_tests.TeacherAuthTest.call.__func__)

    def test_registration_transfer_staff_edit_and_password_reset(self):
        tokens={}
        for who in ('admin','support','firuz','adhamjon','accounting'):
            code, login=self.call('/api/auth/login',dict(email=who+'@abacademypa.com',password=self.password))
            self.assertEqual(code,200)
            code, changed=self.call('/api/auth/change-password',dict(currentPassword=self.password,newPassword='Updated-local-password-123'),login['token'])
            self.assertEqual(code,200)
            tokens[who]=changed['token']
        support=tokens['support'];admin=tokens['admin']
        data=self.call('/api/bootstrap',token=support)[1]
        self.assertEqual(set(g['teacher'] for g in data['classGroups']),{'Firuz','Adhamjon','Behzodjon','Abdulquddus','Abdulwahid'})
        group=next(g for g in data['classGroups'] if g['teacher']=='Firuz')
        target=next(g for g in data['classGroups'] if g['teacher']=='Adhamjon')
        payload=dict(name='Registered Child',age=8,parentName='Parent',parentSurname='',phone='5550101',address='Address',teacher='Firuz',klass=group['name'],program='wrong client program',intakeMode='enroll')
        self.assertEqual(self.call('/api/applications',{**payload,'klass':'Nonexistent'},support)[0],422)
        self.assertEqual(self.call('/api/applications',{**payload,'teacher':'Adhamjon'},support)[0],422)
        code,result=self.call('/api/applications',payload,support)
        self.assertEqual(code,201,result);self.assertEqual(result['status'],'accepted');self.assertEqual(result['program'],group['program'])
        self.assertEqual(self.call('/api/applications',payload,support)[0],409)
        data=self.call('/api/bootstrap',token=tokens['firuz'])[1]
        self.assertEqual(len(data['students']),1);student=data['students'][0]
        self.assertEqual(self.call('/api/bootstrap',token=tokens['adhamjon'])[1]['students'],[])
        staff=next(u for u in self.call('/api/bootstrap',token=admin)[1]['staffUsers'] if u['email']=='firuz@abacademypa.com')
        self.assertEqual(self.call('/api/users/'+staff['id'],{'name':'Renamed Teacher'},support,'PATCH')[0],403)
        self.assertEqual(self.call('/api/users/'+staff['id'],{'name':'Renamed Teacher'},admin,'PATCH')[0],200)
        me=self.call('/api/auth/me',token=tokens['firuz'])[1]
        self.assertEqual(me['name'],'Renamed Teacher');self.assertEqual(me['teacherAlias'],'Firuz')
        self.assertEqual(len(self.call('/api/bootstrap',token=tokens['firuz'])[1]['students']),1)
        path='/api/students/'+student['id']+'/placement'
        self.assertEqual(self.call(path,{'groupId':target['id']},tokens['firuz'],'PUT')[0],403)
        self.assertEqual(self.call(path,{'groupId':target['id']},support,'PUT')[0],200)
        self.assertEqual(self.call('/api/bootstrap',token=tokens['firuz'])[1]['students'],[])
        self.assertEqual(self.call('/api/bootstrap',token=tokens['adhamjon'])[1]['students'][0]['id'],student['id'])
        edit={k:target[k] for k in ('name','teacher','program','schedule','capacity')}
        edit.update(name='New group name',teacher='Firuz',capacity=1)
        self.assertEqual(self.call('/api/groups/'+target['id'],edit,support,'PUT')[0],200)
        data=self.call('/api/bootstrap',token=tokens['firuz'])[1]
        self.assertEqual(data['students'][0]['klass'],'New group name')
        self.assertEqual(data['students'][0]['id'],student['id'])
        self.assertEqual(self.call('/api/applications',{**payload,'name':'Second Child','klass':'New group name'},support)[0],409)
        # Optional teacher review is distinct from enrollment.
        code,review=self.call('/api/applications',{**payload,'name':'Review Child','intakeMode':'review'},support)
        self.assertEqual(code,201);self.assertEqual(review['status'],'teacher_review')
        self.assertEqual(len(self.call('/api/bootstrap',token=tokens['firuz'])[1]['applications']),1)
        self.assertEqual(self.call('/api/applications/'+review['id']+'/status',{'status':'accepted'},tokens['firuz'],'PATCH')[0],200)
        self.assertEqual(len(self.call('/api/bootstrap',token=tokens['firuz'])[1]['students']),2)
        # Admin reset revokes sessions and forces self-service password change.
        reset='/api/users/'+staff['id']+'/reset-password'
        self.assertEqual(self.call(reset,{'temporaryPassword':'Temporary-password-123'},support)[0],403)
        self.assertEqual(self.call(reset,{'temporaryPassword':'short'},admin)[0],422)
        self.assertEqual(self.call(reset,{'temporaryPassword':'Temporary-password-123'},admin)[0],200)
        self.assertEqual(self.call('/api/auth/me',token=tokens['firuz'])[0],401)
        code,login=self.call('/api/auth/login',dict(email='firuz@abacademypa.com',password='Temporary-password-123'))
        self.assertEqual(code,200);self.assertTrue(login['user']['mustChangePassword'])
        self.assertEqual(self.call('/api/bootstrap',token=login['token'])[0],403)
        code,changed=self.call('/api/auth/change-password',dict(currentPassword='Temporary-password-123',newPassword='Teacher-own-password-123'),login['token'])
        self.assertEqual(code,200);self.assertEqual(len(self.call('/api/bootstrap',token=changed['token'])[1]['students']),2)
        self.process.terminate();self.process.wait(timeout=10);self.start_server()
        self.assertEqual(self.call('/api/auth/me',token=changed['token'])[1]['name'],'Renamed Teacher')
        self.assertEqual(len(self.call('/api/bootstrap',token=changed['token'])[1]['students']),2)
