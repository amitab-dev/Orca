'use client'

import CreateWorkspaceModel from "@/components/lauout/create-workspace-model"
import { Navbar } from "@/components/navbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { getErrorMessage } from "@/lib/errors"
import { api } from "@/lib/api"
import { ChevronRight, EllipsisVertical, Info, Plus, Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Workspace } from "@/types/workspace"

export default function Home() {
    const [loading, setLoading] = useState(false)
    const [userWorkspace, setUserWorkspace] = useState<Array<Workspace>>()
    const [createOpen, setCreateOpen] = useState(false)
    const router = useRouter()

    const getUserWokspaces = async () => {
        setLoading(true)
        try {
            const res = await api.get("/api/v1/workspaces/me")
            console.log(res.data?.data);
            setUserWorkspace(res.data.data)
        } catch (error) {
            toast.error(getErrorMessage(error, "Couldn't get your workspaces. Please try again."))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        getUserWokspaces()
    }, [])

    return (
        <>
            <Navbar />
            <div className="w-full h-[calc(100dvh-3.5rem)] flex justify-start items-center flex-col space-y-2 ">
                <div className="w-full h-auto px-60 py-5  justify-between items-center flex" >
                    <div className="flex items-center space-x-2" >
                        <h1 className="font-medium">Your workspaces</h1>
                        {
                            !loading && userWorkspace &&
                            <Badge variant="secondary" >{userWorkspace.length}</Badge>
                        }
                    </div>
                    <Button onClick={() => setCreateOpen(true)}>
                        <span>
                            <Plus />
                        </span>
                        Add a workspace
                    </Button>
                </div>
                {
                    loading ?
                        <>
                            <Spinner />
                        </>
                        :
                        userWorkspace!?.length == 0 ?
                            <>
                                <div className="w-full flex justify-center items-center flex-col" >
                                    <p className="text-xl text-zinc-700/50" >
                                        uh, oh looks like there is no workspace.
                                    </p>
                                    <p className="text-xl text-zinc-700/50" >
                                        Start by creating one.
                                    </p>
                                </div>
                            </>
                            :
                            <div className="w-full px-60 grid grid-cols-3 gap-4" >
                                {
                                    userWorkspace?.map((workspace) => (
                                        <Card key={workspace.id} className="h-40" >
                                            <CardHeader>
                                                <CardTitle>
                                                    {workspace.name}  <Badge variant="outline" className="uppercase" >{workspace.role?.toLowerCase()}</Badge>
                                                </CardTitle>
                                                <CardDescription>{workspace.slug}</CardDescription>
                                                <CardAction>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Workspace options" />} >
                                                            <EllipsisVertical />
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" >
                                                            <DropdownMenuItem onClick={() => router.push(`/workspaces/${workspace.id}/info`)} >
                                                                <Info />
                                                                Info
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => router.push(`/workspaces/${workspace.id}/settings`)} >
                                                                <Settings />
                                                                Settings
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </CardAction>
                                            </CardHeader>
                                            <CardFooter className="mt-auto justify-end" >
                                                <Button onClick={() => router.push(`/workspaces/${workspace.id}`)} >
                                                    Explore
                                                    <ChevronRight />
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    ))
                                }
                            </div>
                }
            </div>
            <CreateWorkspaceModel
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={getUserWokspaces}
            />
        </>
    )
}
