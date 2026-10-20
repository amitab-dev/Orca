'use client'

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

export default function PopupProviver() {
    const [show, setShow] = useState(true)
    return (
        <AnimatePresence initial={false}>
            {
                show &&
                <motion.div
                    key="popup"
                    className="w-full overflow-hidden bg-emerald-600"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                    <motion.div
                        className="py-1 flex justify-between items-center px-60"
                        exit={{ y: -5 }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    >
                        <div className="text-sm text-white flex justify-center items-center space-x-1" >
                            <p>Install ORCA in your repository.</p>
                            <Link href={"/"} className="underline" >
                                get started
                            </Link>
                        </div>
                        <button className="text-sm text-white" onClick={() => setShow(false)} >
                            <X className="size-3" />
                        </button>
                    </motion.div>
                </motion.div>
            }
        </AnimatePresence>
    )
}
