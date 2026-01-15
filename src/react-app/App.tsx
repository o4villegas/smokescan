/**
 * SmokeScan Main Application
 * FDAM Fire Damage Assessment Tool
 */

import { Routes, Route } from 'react-router-dom';
import { ProjectList, ProjectDetail, AssessmentWizard, AssessmentView } from './pages';
import { AppLayout } from './components/layout';

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/projects/:projectId/assess/:assessmentId" element={<AssessmentWizard />} />
        <Route path="/assessments/:id" element={<AssessmentView />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
