'use client'

import { Dialog } from "@base-ui/react/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { getErrorMessage } from "@/lib/errors"
import { App, CreateApp, createAppSchema } from "@/types/app"
import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@/lib/api"
import { AlertCircle, X } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"

type CreateAppModelProps = {
    workspaceId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated?: (app: App) => void
}

const fields = [
    { id: "name", label: "App name", placeholder: "e.g. Marketing site" },
    { id: "sourceRepository", label: "Source repository", placeholder: "e.g. https://github.com/acme/web" },
    { id: "repositoryName", label: "Repository name", placeholder: "e.g. acme/web" },
] as const

export default function CreateAppModel({ workspaceId, open, onOpenChange, onCreated }: CreateAppModelProps) {
    const [loading, setLoading] = useState(false)
    const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateApp>({
        resolver: zodResolver(createAppSchema),
        mode: "onChange",
        defaultValues: { name: "", sourceRepository: "", repositoryName: "" }
    })

    const handleOpenChange = (next: boolean) => {
        if (loading) return
        if (!next) reset()
        onOpenChange(next)
    }

    const handleCreateApp = async (data: CreateApp) => {
        setLoading(true)
        try {
            const res = await api.post(`/api/v1/workspaces/${workspaceId}/apps`, { ...data })
            if (res.status === 201) {
                toast.success("App created")
                onCreated?.(res.data.data)
                reset()
                onOpenChange(false)
            }
        } catch (error) {
            toast.error(getErrorMessage(error, "Couldn't create the app. Please try again."))
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
                            <Dialog.Title className="font-semibold" >Create an app</Dialog.Title>
                            <Dialog.Description className="text-sm text-zinc-500" >Connect a repository to deploy it from this workspace</Dialog.Description>
                        </div>
                        <Dialog.Close render={<Button variant="ghost" size="icon-sm" disabled={loading} />} >
                            <X />
                        </Dialog.Close>
                    </div>
                    <form onSubmit={handleSubmit(handleCreateApp)} className="w-full mt-4 flex flex-col space-y-3" >
                        {
                            fields.map((field, index) => (
                                <div key={field.id} className="w-full flex justify-center items-start flex-col space-y-1.5" >
                                    <Label htmlFor={`app-${field.id}`} >
                                        {field.label}
                                    </Label>
                                    <Input autoComplete="off" autoCapitalize="off" id={`app-${field.id}`} placeholder={field.placeholder} type="text" autoFocus={index === 0} aria-invalid={!!errors[field.id]} disabled={loading} {...register(field.id)} />
                                    {
                                        errors[field.id] &&
                                        <div className="text-red-500 flex justify-center items-center space-x-1.5" >
                                            <AlertCircle className="size-3" />
                                            <p className="text-sm ">{errors[field.id]?.message}</p>
                                        </div>
                                    }
                                </div>
                            ))
                        }
                        <div className="w-full flex justify-end items-center space-x-2 mt-2" >
                            <Dialog.Close render={<Button variant="outline" type="button" disabled={loading} />} >
                                Cancel
                            </Dialog.Close>
                            <Button disabled={loading} type="submit" >
                                {loading ? <Spinner /> : "Create app"}
                            </Button>
                        </div>
                    </form>
                </Dialog.Popup>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
