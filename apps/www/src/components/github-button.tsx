import { Button } from "./ui/button";

export default function GithubAuthenticaion() {
    return (
        <Button className={"w-full h-8"} variant={"secondary"} onClick={() => window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/github`} >
            Continue with GitHub
        </Button>
    )
}