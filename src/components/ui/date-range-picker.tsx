"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
    className?: string
    value?: DateRange
    onChange?: (range: DateRange | undefined) => void
}

export function DateRangePicker({
    className,
    value,
    onChange,
}: DateRangePickerProps) {
    const [date, setDate] = React.useState<DateRange | undefined>(value)

    React.useEffect(() => {
        if (value) setDate(value)
    }, [value])

    const handleSelect = (range: DateRange | undefined) => {
        setDate(range)
        onChange?.(range)
    }

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn(
                            "w-full justify-start text-left font-normal sm:w-[280px]",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "dd MMM yyyy")} –{" "}
                                    {format(date.to, "dd MMM yyyy")}
                                </>
                            ) : (
                                format(date.from, "dd MMM yyyy")
                            )
                        ) : (
                            <span>Pilih Rentang Tanggal</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={handleSelect}
                        numberOfMonths={2}
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}
