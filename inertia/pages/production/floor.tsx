import { type ReactElement, useEffect, useRef } from 'react'
import { Head, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Cpu, Factory, HardHat, Package, PlayCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import { AnimatedBeam } from '@/components/ui/animated-beam'
import { ConfirmPostButton } from '@/components/confirm-post-button'
import { JobCountdown } from '@/components/jobs/job-countdown'
import { StatCard } from '@/components/catalog/stat-card'
import DashboardLayout from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'

type JobStatus = 'in_progress' | 'paused' | 'awaiting_confirmation'

type FloorWorker = {
  id: number
  name: string
  payType: string
  hourlyRateAtAssign: string
}

type FloorStage = {
  id: number
  sequence: number
  name: string
  estimatedDurationMin: number
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  startedAt: string | null
  completedAt: string | null
  autoCompleteAt: string | null
}

type RunningJob = {
  id: number
  number: string
  status: JobStatus
  productId: number
  productName: string
  plannedQty: number
  producedQty: number
  startedAt: string | null
  autoCompleteAt: string | null
  estimatedDurationMin: number | null
  pausedAt: string | null
  remainingSeconds: number | null
  currentStageId: number | null
  currentStageName: string | null
  machine: { id: number; name: string } | null
  workers: FloorWorker[]
  stages: FloorStage[]
}

type DraftJob = {
  id: number
  number: string
  productName: string
  plannedQty: number
  createdAt: string | null
}

type PageProps = {
  runningJobs: RunningJob[]
  draftJobs: DraftJob[]
  serverNow: string
}

/** How often the board pulls fresh state from the server. */
const REFRESH_MS = 5000

function NodeCard({
  icon: Icon,
  title,
  subtitle,
  tone = 'muted',
  innerRef,
}: {
  icon: typeof Cpu
  title: string
  subtitle?: string
  tone?: 'muted' | 'primary' | 'accent'
  innerRef?: React.Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={innerRef}
      className={cn(
        'z-10 flex items-center gap-2 rounded-xl border bg-background px-3 py-2 shadow-sm',
        tone === 'primary' && 'border-primary/40 bg-primary/5',
        tone === 'accent' && 'border-amber-500/40 bg-amber-500/5'
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg',
          tone === 'primary'
            ? 'bg-primary text-primary-foreground'
            : tone === 'accent'
              ? 'bg-amber-500 text-white'
              : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  )
}

function JobPipeline({ job, serverNow }: { job: RunningJob; serverNow: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const jobRef = useRef<HTMLDivElement>(null)
  const machineRef = useRef<HTMLDivElement>(null)

  // One stable ref object per worker, shared by the node and its beam. These
  // must be the same object across renders: the beam reads `.current` after
  // commit, so a fresh `{ current: … }` built during render would still hold
  // null and the beam would never draw.
  const workerRefs = useRef<React.RefObject<HTMLDivElement | null>[]>([])
  if (workerRefs.current.length !== job.workers.length) {
    workerRefs.current = job.workers.map((_, i) => workerRefs.current[i] ?? { current: null })
  }

  const paused = job.status === 'paused'

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-stretch gap-6 p-2 md:flex-row md:items-center md:justify-between"
    >
      {/* Workers — left */}
      <div className="flex flex-col gap-3 md:w-56">
        {job.workers.length === 0 ? (
          <div className="rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
            No workers assigned
          </div>
        ) : (
          job.workers.map((w, i) => (
            <NodeCard
              key={w.id}
              innerRef={workerRefs.current[i]}
              icon={HardHat}
              title={w.name}
              subtitle={`${w.payType} · ${w.hourlyRateAtAssign}/h`}
              tone="accent"
            />
          ))
        )}
      </div>

      {/* Job — centre */}
      <div className="z-10 flex flex-col items-center gap-2 md:w-64">
        <div
          ref={jobRef}
          className="flex w-full flex-col items-center rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 shadow-sm"
        >
          <Factory className="size-5 text-primary" />
          <div className="mt-1 font-mono text-xs text-muted-foreground">{job.number}</div>
          <div className="text-center text-sm font-medium">{job.productName}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {job.producedQty} / {job.plannedQty} planned
          </div>
          <div className="mt-2 text-sm">
            <JobCountdown
              autoCompleteAt={job.autoCompleteAt}
              remainingSeconds={job.remainingSeconds}
              paused={paused}
              serverNow={serverNow}
            />
          </div>
          {job.currentStageName && (
            <div className="mt-1 text-xs text-muted-foreground">Stage: {job.currentStageName}</div>
          )}
        </div>
      </div>

      {/* Machine — right */}
      <div className="flex flex-col gap-3 md:w-56">
        {job.machine ? (
          <NodeCard
            innerRef={machineRef}
            icon={Cpu}
            title={job.machine.name}
            subtitle="Machine"
            tone="primary"
          />
        ) : (
          <div className="rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
            Hand work — no machine
          </div>
        )}
      </div>

      {/* Beams: each worker → job, and job → machine. Paused jobs stop moving. */}
      {!paused &&
        job.workers.map((w, i) => (
          <AnimatedBeam
            key={`beam-worker-${w.id}`}
            containerRef={containerRef}
            fromRef={workerRefs.current[i]}
            toRef={jobRef}
            curvature={i % 2 === 0 ? 20 : -20}
            duration={4}
            delay={i * 0.4}
            gradientStartColor="#f59e0b"
            gradientStopColor="#ef4444"
          />
        ))}
      {!paused && job.machine && (
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={jobRef}
          toRef={machineRef}
          duration={4}
          gradientStartColor="#6366f1"
          gradientStopColor="#0ea5e9"
        />
      )}
    </div>
  )
}

function JobCard({ job, serverNow }: { job: RunningJob; serverNow: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Link href={`/jobs/${job.id}`} className="underline-offset-2 hover:underline">
            {job.number}
          </Link>
          <StatusBadge kind="job" status={job.status} />
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {job.status === 'in_progress' && (
            <ConfirmPostButton
              path={`/jobs/${job.id}/pause`}
              label="Pause"
              variant="outline"
              size="sm"
            />
          )}
          {job.status === 'paused' && (
            <ConfirmPostButton path={`/jobs/${job.id}/resume`} label="Resume" size="sm" />
          )}
          {(job.status === 'in_progress' || job.status === 'paused') && (
            <ConfirmPostButton
              path={`/jobs/${job.id}/skip-stage`}
              label="Skip stage"
              variant="outline"
              size="sm"
              confirmTitle="Skip the current stage?"
            />
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/jobs/${job.id}`}>Open</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <JobPipeline job={job} serverNow={serverNow} />
        {job.status === 'awaiting_confirmation' && (
          <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
            This job has finished its stages — open it to confirm the produced quantity.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function ProductionFloor({ runningJobs, draftJobs, serverNow }: PageProps) {
  // Poll for fresh state. `only` keeps the payload to the board's own props.
  useEffect(() => {
    const id = setInterval(() => {
      router.reload({ only: ['runningJobs', 'draftJobs', 'serverNow'] })
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const workersOnFloor = runningJobs.reduce((sum, j) => sum + j.workers.length, 0)
  const machinesRunning = runningJobs.filter((j) => j.machine).length

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-8">
      <Head title="Production floor" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Production floor</h1>
          <p className="text-sm text-muted-foreground">
            Live view of every job holding people or machines. Refreshes automatically.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/jobs">All jobs</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Jobs running" value={runningJobs.length} icon={Factory} />
        <StatCard label="Workers on the floor" value={workersOnFloor} icon={HardHat} />
        <StatCard label="Machines in use" value={machinesRunning} icon={Cpu} />
      </div>

      {runningJobs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={PlayCircle}
              title="Nothing running"
              description="Start a draft job below to put it on the floor."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {runningJobs.map((job) => (
            <JobCard key={job.id} job={job} serverNow={serverNow} />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ready to run</CardTitle>
        </CardHeader>
        <CardContent>
          {draftJobs.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No draft jobs"
              description="Create a job to queue up the next production run."
              action={
                <Button asChild>
                  <Link href="/jobs">Go to jobs</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draftJobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">{j.number}</TableCell>
                    <TableCell>{j.productName}</TableCell>
                    <TableCell className="text-right">{j.plannedQty}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {j.createdAt?.slice(0, 10) ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm">
                        <Link href={`/jobs/${j.id}`}>Start…</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

ProductionFloor.layout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
