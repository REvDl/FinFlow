import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import { statsAPI, transactionsAPI, TotalResponse, ChartPoint, DayTransaction } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { format, parseISO, eachDayOfInterval, startOfDay } from "date-fns";
import { DayTransactionsModal } from "./DayTransactionsModal";

const GRADIENTS = (
  <defs>
    <linearGradient id="grad1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#4df1ff" stopOpacity={1} />
      <stop offset="100%" stopColor="#2b65f0" stopOpacity={1} />
    </linearGradient>
    <linearGradient id="grad2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#2b65f0" stopOpacity={1} />
      <stop offset="100%" stopColor="#c749ff" stopOpacity={1} />
    </linearGradient>
    <linearGradient id="grad3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#00e5ff" stopOpacity={1} />
      <stop offset="100%" stopColor="#00acc1" stopOpacity={1} />
    </linearGradient>
    <linearGradient id="grad4" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#d500f9" stopOpacity={1} />
      <stop offset="100%" stopColor="#aa00ff" stopOpacity={1} />
    </linearGradient>
    <linearGradient id="grad5" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#2962ff" stopOpacity={1} />
      <stop offset="100%" stopColor="#1a237e" stopOpacity={1} />
    </linearGradient>

    <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
      <feOffset dx="2" dy="4" result="offsetblur" />
      <feComponentTransfer><feFuncA type="linear" slope="0.3" /></feComponentTransfer>
      <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
);

const CHART_GRADIENT_IDS = ["url(#grad1)", "url(#grad2)", "url(#grad3)", "url(#grad4)", "url(#grad5)"];
const CHART_SOLID_COLORS = ["#2b65f0", "#c749ff", "#00acc1", "#aa00ff", "#1a237e"];
const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", UAH: "₴", EUR: "€", PLN: "zł" };

export function DashboardCharts() {
  const { currency, dateRange, formatDateForAPI } = useDashboard();
  const { isAuthenticated } = useAuth();
  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [dayTransactions, setDayTransactions] = useState<DayTransaction[]>([]);

  const startStr = formatDateForAPI(dateRange.start);
  const endStr = formatDateForAPI(dateRange.end);

  const { data: diagramData, isFetching: isDiagramFetching } = useQuery<ChartPoint[]>({
    queryKey: ["diagram-data", currency, startStr, endStr],
    queryFn: () => statsAPI.getDiagram({ start: startStr, end: endStr, to_currency: currency }),
    enabled: isAuthenticated && !!startStr && !!endStr,
    retry: 1,
  });

  const { data: totalsData } = useQuery<TotalResponse>({
    queryKey: queryKeys.totals(currency, startStr, endStr),
    queryFn: () => transactionsAPI.getTotal({ to_currency: currency, start: startStr, end: endStr }),
    enabled: isAuthenticated && !!startStr && !!endStr,
  });

  const handleChartAction = async (state: any, explicitType?: "income" | "spending") => {
    const date = state?.payload?.date || state?.activeLabel || (state?.activePayload && state.activePayload[0]?.payload?.date);
    const type = explicitType || state?.dataKey || (state?.activePayload && state.activePayload[0]?.dataKey) || "spending";

    if (date && type) {
      try {
        const data = await statsAPI.getByDay({
          date: date,
          transaction_type: type as "income" | "spending",
          to_currency: currency
        });
        setDayTransactions(data);
        setSelectedDate(date);
        setIsModalOpen(true);
      } catch (err) {
        console.error(`[FETCH_BY_DAY_ERROR]`, err);
      }
    }
  };

  const lineData = useMemo(() => {
    if (!diagramData || !Array.isArray(diagramData) || diagramData.length === 0) return [];
    const apiMap = new Map();
    diagramData.forEach(item => {
      const d = item.date;
      if (!apiMap.has(d)) apiMap.set(d, { income: 0, spending: 0 });
      apiMap.get(d)[item.transaction_type] = Number(item.total_amount);
    });

    try {
      const days = eachDayOfInterval({ start: startOfDay(dateRange.start), end: startOfDay(dateRange.end) });
      return days.map(day => {
        const isoDay = format(day, "yyyy-MM-dd");
        const vals = apiMap.get(isoDay) || { income: 0, spending: 0 };
        return { date: isoDay, ...vals };
      });
    } catch (e) { return []; }
  }, [diagramData, dateRange]);

  const pieData = useMemo(() => {
    if (!totalsData?.categories) return [];
    return Object.entries(totalsData.categories)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [totalsData]);

  const yAxisMax = useMemo(() => {
    if (lineData.length === 0) return 100;
    const maxValue = Math.max(...lineData.map(point => Math.max(point.income, point.spending)));
    return maxValue <= 0 ? 100 : Math.ceil(maxValue * 1.1);
  }, [lineData]);

  const yAxisTicks = useMemo(() => {
    const segments = 4;
    const step = yAxisMax / segments;
    return Array.from({ length: segments + 1 }, (_, index) => Math.round(step * index));
  }, [yAxisMax]);

  return (
    <div className="w-full mt-4 pb-10 px-4 font-sans">
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[1600px] mx-auto transition-opacity duration-300 ${isDiagramFetching ? 'opacity-60' : 'opacity-100'}`}>

        <Card className="lg:col-span-2 rounded-3xl border border-border bg-card/50 backdrop-blur-md p-6 shadow-sm overflow-hidden">
          <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              Balance Dynamics ({currency})
              {isDiagramFetching && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
            </CardTitle>
          </CardHeader>

          <CardContent className="h-[350px] w-full p-0">
            {lineData.length > 0 ? (
              <div className="w-full h-full flex gap-0">
                {/* СТАТИЧНАЯ ЛЕВАЯ ПАНЕЛЬ С КРУПНЫМИ ЦИФРАМИ */}
                <div className="w-[70px] shrink-0 z-20 bg-transparent">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 34, right: 0, left: 10, bottom: 28 }}>
                      <YAxis
                        width={60}
                        fontSize={12} // Увеличен размер
                        tickLine={false}
                        axisLine={false}
                        domain={[0, yAxisMax]}
                        ticks={yAxisTicks}
                        tickFormatter={(v) => `${currencySymbol}${v}`}
                        tick={{
                          fill: 'var(--muted-foreground)',
                          opacity: 0.9,
                          fontWeight: 600 // Сделал жирнее
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* ПРОКРУЧИВАЕМЫЙ КОНТЕНТ */}
                <div className="flex-1 min-w-0 relative">
                  {/* СТАТИЧНАЯ ЛЕГЕНДА */}
                  <div className="absolute top-0 right-4 z-10 flex items-center gap-4 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: "linear-gradient(135deg, #4df1ff, #2b65f0)" }} />
                      Income
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: "linear-gradient(135deg, #2b65f0, #c749ff)" }} />
                      Spending
                    </span>
                  </div>

                  <div className="w-full h-full overflow-x-auto overflow-y-hidden custom-scrollbar pt-6">
                    <div style={{ minWidth: lineData.length > 31 ? `${lineData.length * 24}px` : '100%', height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lineData} style={{ cursor: 'pointer' }} margin={{ top: 4, right: 20, left: -5, bottom: 0 }}>
                          {GRADIENTS}
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                          <XAxis
                            dataKey="date"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => format(parseISO(v), "dd MMM")}
                            dy={10}
                          />
                          <YAxis hide domain={[0, yAxisMax]} ticks={yAxisTicks} />

                          <Tooltip
                            wrapperStyle={{ pointerEvents: 'none', outline: 'none' }}
                            contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '12px' }}
                            cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                            formatter={(value: number, name: string) => [`${currencySymbol}${value.toLocaleString()}`, name]}
                          />

                          <Line
                            type="monotone"
                            dataKey="income"
                            stroke="url(#grad1)"
                            strokeWidth={3}
                            dot={lineData.length < 45}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="spending"
                            stroke="url(#grad2)"
                            strokeWidth={3}
                            dot={lineData.length < 45}
                            isAnimationActive={false}
                          />

                          {/* Прозрачные области для кликабельности */}
                          <Line
                            type="monotone"
                            dataKey="income"
                            stroke="transparent"
                            strokeWidth={20}
                            dot={false}
                            activeDot={{
                              r: 5,
                              strokeWidth: 2,
                              stroke: "var(--background)",
                              fill: "#4df1ff",
                              onClick: (e, p) => handleChartAction(p, "income")
                            }}
                            tooltipType="none"
                          />
                          <Line
                            type="monotone"
                            dataKey="spending"
                            stroke="transparent"
                            strokeWidth={20}
                            dot={false}
                            activeDot={{
                              r: 5,
                              strokeWidth: 2,
                              stroke: "var(--background)",
                              fill: "#c749ff",
                              onClick: (e, p) => handleChartAction(p, "spending")
                            }}
                            tooltipType="none"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            ) : <div className="flex h-full items-center justify-center text-muted-foreground italic text-sm">No data found</div>}
          </CardContent>
        </Card>

        {/* Expense Categories */}
        <Card className="rounded-3xl border border-border bg-card/50 backdrop-blur-md p-6 shadow-xl overflow-hidden flex flex-col">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Expense Categories</CardTitle>
          </CardHeader>
          <CardContent className="h-[380px] p-0 relative">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {GRADIENTS}
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={5}
                    dataKey="value"
                    minAngle={15}
                    stroke="none"
                    filter="url(#pieShadow)"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_GRADIENT_IDS[index % CHART_GRADIENT_IDS.length]} style={{ cursor: 'pointer', outline: 'none' }} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    itemStyle={{ color: 'var(--foreground)', fontSize: '12px', fontWeight: 'bold' }}
                    formatter={(value: number, name: string) => [`${currencySymbol}${value.toLocaleString()}`, name]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '20px', paddingBottom: '10px' }}
                    formatter={(value, _, index) => (
                      <span style={{ color: CHART_SOLID_COLORS[index % CHART_SOLID_COLORS.length], fontWeight: 600 }}>
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-muted-foreground italic text-sm">Insufficient data</div>}
          </CardContent>
        </Card>
      </div>

      <DayTransactionsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        date={selectedDate}
        transactions={dayTransactions}
      />
    </div>
  );
}