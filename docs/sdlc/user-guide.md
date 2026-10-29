# CivicFlow user guide

CivicFlow lets citizens report public service problems and follow them until they are resolved. Officers handle the complaints for their department, and Administrators manage access and service categories. Screenshots use fictional data.

> **Privacy:** you stay signed in only while the page is open. Refreshing or closing the tab signs you out.

## Citizens

### Create an account and sign in
1. Open CivicFlow and choose **Create account**.
2. Enter your full name, your email and a password of at least 12 characters.
3. Open the confirmation email and follow the link.
4. Sign in with your email and password. You'll see your **Overview** ([screenshot](screens/02-citizen-overview.png)).

Forgot your password? Choose **Forgot password?** on the sign-in page and follow the emailed link.

### Make a complaint
1. Choose **Make a complaint** ([screenshot](screens/03-citizen-new-complaint.png)).
2. Select the **service category** (for example Road maintenance). Choose *Other* if nothing fits.
3. **Describe the issue** in 10–5,000 characters.
4. Mark the location: click the map, drag the pin, type the latitude and longitude, or press **Use my current location** if you are standing at the issue (your browser asks for permission once). Then add a short **location description**.
5. Press **Submit complaint**. You'll see your reference, for example `CF-3A1B2C3D`.
6. *(Optional)* While the complaint is still **Submitted**, attach up to five JPEG, PNG or PDF files of up to 5 MiB each. If an upload fails, your complaint is still saved: press **Retry upload**.

### Follow your complaints
- **My complaints** lists your complaints with search and a status filter ([screenshot](screens/05-citizen-my-complaints.png)).
- Open a complaint to see the progress steps (Submitted → Under review → In progress → Resolved), the location, files and the **complaint history** ([screenshot](screens/04-citizen-complaint-detail.png)).
- **Updates** shows every change to your complaints. The number in the menu is how many you haven't read. Use **Mark as read** or **Mark all as read**, or open **View complaint** ([screenshot](screens/07-citizen-updates-inbox.png)).

### Give feedback
When a complaint is **Resolved**, its page shows **How was the service?** Choose a rating from 1 (Very poor) to 5 (Excellent), optionally add a comment, and press **Submit feedback**. You can give feedback once per complaint, and you can't change it afterwards ([screenshot](screens/06-citizen-resolved-feedback.png)).

### Withdraw a complaint
If a complaint isn't needed any more and isn't resolved yet, open it, choose **Withdraw complaint**, explain why (10–2,000 characters), tick the confirmation and press **Confirm withdrawal**. A withdrawal can't be undone. The complaint and its history are kept.

## Officers

Officer accounts are created by an Administrator. You'll receive an invitation email: open it and choose your own password.

1. **Overview** shows your department's open complaints and those assigned to you ([screenshot](screens/08-officer-overview.png)).
2. **Department complaints** and **Assigned to me** list complaints, with search and filters for status, category, priority and unassigned complaints ([screenshot](screens/09-officer-department-queue.png)).
3. Open a complaint and use **Process complaint** ([screenshot](screens/10-officer-process-complaint.png)):
   - **Begin review** (Submitted → Under review), optionally with a remark.
   - **Assign / reassign Officer** in your department. After work has started, reassigning needs a reason.
   - **Set priority** (Low, Normal, High, Urgent).
   - **Transfer to another service**: move it to another department's category (before work starts, with a reason).
   - **Start work** *(assigned Officer only)*.
   - **Add progress update** *(assigned Officer only)*. The Citizen can read your remarks, so write them clearly and leave out unnecessary personal details.
   - **Resolve complaint** *(assigned Officer only)*: enter the resolution details, tick the confirmation and save ([screenshot](screens/11-officer-resolved.png)).
4. If someone else changed the complaint while you were viewing it, you'll see a message asking you to **Refresh**. Your text is kept.

New complaints are **assigned automatically** to the Officer in your department with the fewest open complaints, and you'll get an **Updates** notification. Badges such as *Due in 2 days* or *Overdue by 1 day* show each complaint's service target (urgent 1 day, high 3, normal 7, low 14). **Department map** shows open complaints by priority.

Resolved and Withdrawn complaints can be read but not changed.

## Administrators

- **Dispatch centre:** coverage cards show each department's Officers, open and unassigned complaints, and departments with **no Officers** are highlighted. *Needs attention* lists complaints that are unstaffed, unassigned or past their service target. Choose **Dispatch**, pick the department, category and (optionally) an Officer, explain why, and **Confirm dispatch**. The citizen sees your reason in their history. Work already in progress can be reassigned to another Officer of the same department, but can't change department.
- **Analytics:** service performance, coverage, Officer workload, satisfaction and a 6-month trend. Use **Export CSV** to download the figures.

- **Overview** shows complaint counts by status, how many are open, and the average feedback rating ([screenshot](screens/12-admin-overview-monitoring.png)). Monitoring is read-only.
- **User management:** search users, then use **Edit access** to change name, role, department (required for Officers) or active status. The system always keeps at least one active Administrator. An Officer's open assignments must be reassigned before their access changes.
- **Create Officer account:** enter a name, email and department. The person receives an invitation email and chooses their own password.
- **Service categories:** **New category** or **Edit** a category's name, description and receiving department, and set *Available for new complaints* ([screenshot](screens/13-admin-service-categories.png)). Categories are never deleted. Deactivate one to hide it from new complaints. A category that already has complaints keeps its department: create a new category instead.

## Troubleshooting

| Message | What it means / what to do |
| --- | --- |
| "This complaint changed while you were viewing it" | Press **Refresh**, review the latest update and try again |
| "The complaint service is not available yet" | The server setup for this feature isn't installed. Contact the project administrator. |
| "You do not have permission to perform this action" | Your role or department doesn't allow it, or your account was deactivated |
| Map tiles don't load | Type the latitude and longitude instead. Submission still works. |
