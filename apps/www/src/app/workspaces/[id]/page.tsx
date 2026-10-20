'use client'

import CreateAppModel from "@/components/layout/create-app-model"
import { Navbar } from "@/components/navbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { cn } from "cn"
import { App, AppStatus } from "@/types/app"
import { Workspace } from "@/types/workspace"
import { ArrowLeft, Boxes, GitBranch, Info, Plus, Settings } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"

const statusStyles: Record<AppStatus, { label: string, dot: string }> = {
    "NOT STARTED": { label: "Not started", dot: "bg-zinc-400" },
    "QUEUED": { label: "Queued", dot: "bg-amber-500" },
    "DEPLOYED": { label: "Deployed", dot: "bg-emerald-500" },
}

const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""

export default function DynamicWorkspace() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [workspace, setWorkspace] = useState<Workspace>()
    const [apps, setApps] = useState<Array<App>>([])
    const [createOpen, setCreateOpen] = useState(false)

    const getApps = async () => {
        try {
            const res = await api.get(`/api/v1/workspaces/${id}/apps`)
            setApps(res.data.data)
        } catch (error) {
            toast.error(getErrorMessage(error, "Couldn't get the apps. Please try again."))
        }
    }

    const getWorkspace = async () => {
        try {
            const [workspaceRes, appsRes] = await Promise.all([
                api.get(`/api/v1/workspaces/${id}`),
                api.get(`/api/v1/workspaces/${id}/apps`),
            ])
            setWorkspace(workspaceRes.data.data)
            setApps(appsRes.data.data)
        } catch (error) {
            toast.error(getErrorMessage(error, "Couldn't get this workspace. Please try again."))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        getWorkspace()
    }, [id])

    const canWrite = workspace?.role !== "VIEWER"
    const stats = [
        { label: "Total apps", value: apps.length },
        { label: "Deployed", value: apps.filter((app) => app.status === "DEPLOYED").length },
        { label: "Queued", value: apps.filter((app) => app.status === "QUEUED").length },
        { label: "Not started", value: apps.filter((app) => app.status === "NOT STARTED").length },
    ]

    return (
        <>
            <Navbar />
            <div className="w-full h-[calc(100dvh-3.5rem)] flex justify-start items-center flex-col" >
                {
                    loading ?
                        <div className="w-full flex-1 flex justify-center items-center" >
                            <Spinner />
                        </div>
                        :
                        !workspace ?
                            <div className="w-full flex-1 flex justify-center items-center flex-col space-y-3" >
                                <p className="text-xl text-zinc-700/50" >
                                    We couldn&apos;t find this workspace.
                                </p>
                                <Button variant="outline" onClick={() => router.push("/home")} >
                                    <ArrowLeft />
                                    Back to workspaces
                                </Button>
                            </div>
                            :
                            <div className="w-full px-60 py-5 flex flex-col space-y-6" >
                                <div className="flex flex-col space-y-4" >
                                    <Button variant="ghost" size="sm" className="w-fit -ml-2 text-zinc-500" onClick={() => router.push("/home")} >
                                        <ArrowLeft />
                                        Workspaces
                                    </Button>
                                    <div className="flex justify-between items-end" >
                                        <div className="flex flex-col space-y-1" >
                                            <div className="flex items-center space-x-2" >
                                                <h1 className="text-xl font-semibold" >{workspace.name}</h1>
                                                <Badge variant="outline" className="uppercase" >{workspace.role?.toLowerCase()}</Badge>
                                            </div>
                                            <p className="text-sm text-zinc-500" >
                                                {workspace.slug}
                                                {workspace.createdAt && <> · Created {formatDate(workspace.createdAt)}</>}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-2" >
                                            <Button variant="outline" size="icon" aria-label="Workspace info" onClick={() => router.push(`/workspaces/${id}/info`)} >
                                                <Info />
                                            </Button>
                                            <Button variant="outline" size="icon" aria-label="Workspace settings" onClick={() => router.push(`/workspaces/${id}/settings`)} >
                                                <Settings />
                                            </Button>
                                            {
                                                canWrite &&
                                                <Button onClick={() => setCreateOpen(true)} >
                                                    <Plus />
                                                    New app
                                                </Button>
                                            }
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-4" >
                                    {
                                        stats.map((stat) => (
                                            <div key={stat.label} className="rounded-lg ring-1 ring-foreground/10 px-4 py-3 flex flex-col space-y-1" >
                                                <span className="text-xs text-zinc-500" >{stat.label}</span>
                                                <span className="text-2xl font-semibold tabular-nums" >{stat.value}</span>
                                            </div>
                                        ))
                                    }
                                </div>

                                <div className="flex flex-col space-y-3" >
                                    <div className="flex items-center space-x-2" >
                                        <h2 className="font-medium" >Apps</h2>
                                        <Badge variant="secondary" >{apps.length}</Badge>
                                    </div>
                                    {
                                        apps.length === 0 ?
                                            <div className="w-full rounded-lg border border-dashed border-zinc-950/20 py-16 flex justify-center items-center flex-col space-y-3" >
                                                <Boxes className="size-8 text-zinc-400" />
                                                <div className="flex flex-col items-center" >
                                                    <p className="font-medium" >No apps yet</p>
                                                    <p className="text-sm text-zinc-500" >
                                                        {canWrite ? "Connect a repository to deploy your first app." : "Apps added to this workspace will show up here."}
                                                    </p>
                                                </div>
                                                {
                                                    canWrite &&
                                                    <Button variant="outline" onClick={() => setCreateOpen(true)} >
                                                        <Plus />
                                                        New app
                                                    </Button>
                                                }
                                            </div>
                                            :
                                            <div className="grid grid-cols-3 gap-4" >
                                                {
                                                    apps.map((app) => (
                                                        <Card key={app.id} className="h-40 cursor-pointer transition-shadow hover:ring-foreground/20" onClick={() => router.push(`/workspaces/${id}/apps/${app.id}`)} >
                                                            <CardHeader>
                                                                <CardTitle>{app.name}</CardTitle>
                                                                <CardDescription className="flex items-center space-x-1 truncate" >
                                                                    <GitBranch className="size-3 shrink-0" />
                                                                    <span className="truncate" >{app.repositoryName}</span>
                                                                </CardDescription>
                                                            </CardHeader>
                                                            <CardFooter className="mt-auto justify-between" >
                                                                <div className="flex items-center space-x-1.5" >
                                                                    <span className={cn("size-2 rounded-full", statusStyles[app.status].dot)} />
                                                                    <span className="text-zinc-600" >{statusStyles[app.status].label}</span>
                                                                </div>
                                                                <span className="text-zinc-500" >{formatDate(app.updatedAt)}</span>
                                                            </CardFooter>
                                                        </Card>
                                                    ))
                                                }
                                            </div>
                                    }
                                </div>
                            </div>
                }
            </div>
            <CreateAppModel
                workspaceId={id}
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={getApps}
            />
        </>
    )
}
