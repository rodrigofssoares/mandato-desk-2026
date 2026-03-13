import { DashboardStatsCards } from '@/components/dashboard/DashboardStatsCards';
import { GrowthMetricsCards } from '@/components/dashboard/GrowthMetricsCards';
import { GrowthChart } from '@/components/dashboard/GrowthChart';
import { TagDistributionChart } from '@/components/dashboard/TagDistributionChart';
import { VoteDeclarationChart } from '@/components/dashboard/VoteDeclarationChart';
import { BirthdaySection } from '@/components/dashboard/BirthdaySection';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';

export default function Dashboard() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Top row: 4 stat cards */}
      <DashboardStatsCards />

      {/* Second row: 5 growth metric cards */}
      <GrowthMetricsCards />

      {/* Main content: charts left, sidebar right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: charts */}
        <div className="lg:col-span-2 space-y-6">
          <GrowthChart />
          <TagDistributionChart />
          <VoteDeclarationChart />
        </div>

        {/* Right column: birthdays + activity feed */}
        <div className="space-y-6">
          <BirthdaySection />
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
