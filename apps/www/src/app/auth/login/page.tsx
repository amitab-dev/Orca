'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Login, loginSchema } from "@/types/auth"
import { zodResolver } from "@hookform/resolvers/zod"
import { getErrorMessage } from "@/lib/errors"
import axios from "axios"
import { AlertCircle, ChevronRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"

export default function LoginPage() {
    const [loading, setLoading] = useState(false)
    const { register, handleSubmit, formState: { errors } } = useForm<Login>({
        resolver: zodResolver(loginSchema),
        mode: "onChange"
    })

    const router = useRouter()
    const handleLoginUser = async (data: Login) => {
        setLoading(true)
        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, { ...data }, { withCredentials: true })
            if (res.status === 200) {
                router.push("/home")
            }
        } catch (error) {
            toast.error(getErrorMessage(error, "Couldn't log you in. Please try again."))
        } finally {
            setLoading(false)
        }
    }


    return (
        <>
            <div className="w-full h-screen flex justify-center items-center" >
                <div className="w-1/3 h-auto pt-7 pb-3 px-5 border border-zinc-950/20 shaow-sm rounded-lg" >
                    <form onSubmit={handleSubmit(handleLoginUser)} className="w-full h-full flex justify-center items-center flex-col space-y-3" >
                        <div className="w-full h-full flex justify-center items-center flex-col" >
                            <h1 className="font-semibold" >Login to your account</h1>
                            <p className="text-sm text-zinc-500" >Enter your creadentials to continue</p>
                        </div>
                        <div className="w-full flex justify-center items-start flex-col space-y-1.5 " >
                            <Label>
                                Email
                            </Label>
                            <Input placeholder="e.g. elonmust@gmail.com" type="text"  {...register("email")} />
                            {
                                errors.email &&
                                <>
                                    <div className="text-red-500 flex justify-center items-center space-x-1.5" >
                                        <AlertCircle className="size-3" />
                                        <p className="text-sm ">{errors.email.message}</p>
                                    </div>
                                </>
                            }
                        </div>
                        <div className="w-full flex justify-center items-start flex-col space-y-1.5 " >
                            <Label>
                                Password
                            </Label>
                            <Input placeholder="e.g. Your super $trong p455w0rd here" type="password" {...register("password")} />
                            {
                                errors.password &&
                                <>
                                    <div className="text-red-500 flex justify-center items-center space-x-1.5" >
                                        <AlertCircle className="size-3" />
                                        <p className="text-sm ">{errors.password.message}</p>
                                    </div>
                                </>
                            }
                        </div>
                        <Button disabled={loading} type="submit" className="w-full mt-2 h-8" >
                            {
                                loading ? <><span className="animate-spin" ><Loader2 /></span></> : <>
                                    Continue
                                    <span>
                                        <ChevronRight />
                                    </span>
                                </>
                            }
                        </Button>
                    </form>
                    <Separator className={"my-2"} />
                    <Button className={"w-full h-8"} variant={"secondary"} >
                        Continue with GitHub
                    </Button>
                    <Separator className={"my-2"} />
                    <div className="w-full mt-2 flex justify-start items-start space-x-1.5">
                        <p className="text-sm" >Already have an account ?</p>
                        <Link href={"/auth/login"} className="text-primary text-sm" >Login</Link >
                    </div>
                </div>
            </div>
        </>
    )
}