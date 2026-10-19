'use client'

import { Dialog } from "@base-ui/react/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { getErrorMessage } from "@/lib/errors"
import { CreateWorkspace, createWorkspaceSchema, Workspace } from "@/types/workspace"
import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@/lib/api"
import { AlertCircle, X } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"

type CreateWorkspaceModelProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated?: (workspace: Workspace) => void
}

export default function CreateWorkspaceModel({ open, onOpenChange, onCreated }: CreateWorkspaceModelProps) {
    const [loading, setLoading] = useState(false)
    const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateWorkspace>({
        resolver: zodResolver(createWorkspaceSchema),
        mode: "onChange",
        defaultValues: { name: "" }
    })

    const handleOpenChange = (next: boolean) => {
        if (loading) return
        if (!next) reset()
        onOpenChange(next)
    }

    const handleCreateWorkspace = async (data: CreateWorkspace) => {
        setLoading(true)
        try {
            const res = await api.post("/api/v1/workspaces", { ...data })
            if (res.status === 201) {
                toast.success("Workspace created")
                onCreated?.(res.data.data)
                reset()
                onOpenChange(false)
            }
        } catch (error) {
            toast.error(getErrorMessage(error, "Couldn't create the workspace. Please try again."))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog.Root open={open} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 bg-zinc-950/30 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0" />
                <Dialog.Popup className="fixed top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-950/20 bg-background px-5 pt-5 pb-4 shadow-sm transition-all duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0">
                    <div className="w-full flex justify-between items-start" >
                        <div className="flex flex-col" >
                            <Dialog.Title className="font-semibold" >Create a workspace</Dialog.Title>
                            <Dialog.Description className="text-sm text-zinc-500" >Give your workspace a name to get started</Dialog.Description>
                        </div>
                        <Dialog.Close render={<Button variant="ghost" size="icon-sm" disabled={loading} />} >
                            <X />
                        </Dialog.Close>
                    </div>
                    <form onSubmit={handleSubmit(handleCreateWorkspace)} className="w-full mt-4 flex flex-col space-y-3" >
                        <div className="w-full flex justify-center items-start flex-col space-y-1.5" >
                            <Label htmlFor="workspace-name" >
                                Workspace name
                            </Label>
                            <Input autoComplete="off" autoCapitalize="off" id="workspace-name" placeholder="e.g. Acme Inc" type="text" autoFocus aria-invalid={!!errors.name} disabled={loading} {...register("name")}  />
                            {
                                errors.name &&
                                <>
                                    <div className="text-red-500 flex justify-center items-center space-x-1.5" >
                                        <AlertCircle className="size-3" />
                                        <p className="text-sm ">{errors.name.message}</p>
                                    </div>
                                </>
                            }
                        </div>
                        <div className="w-full flex justify-end items-center space-x-2 mt-2" >
                            <Dialog.Close render={<Button variant="outline" type="button" disabled={loading} />} >
                                Cancel
                            </Dialog.Close>
                            <Button disabled={loading} type="submit" >
                                {loading ? <Spinner /> : "Create workspace"}
                            </Button>
                        </div>
                    </form>
                </Dialog.Popup>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
