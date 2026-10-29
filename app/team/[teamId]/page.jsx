import TeamWorkspace from '../../../components/TeamWorkspace';

export const metadata = { title: 'Team · Module Task Tracker' };

export default function Page({ params }) {
  return <TeamWorkspace teamId={params.teamId} />;
}
