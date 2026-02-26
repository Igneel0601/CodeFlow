# You can use most Debian-based base images
FROM node:21-slim

# Install curl
RUN apt-get update && apt-get install -y curl && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY compile_page.sh /compile_page.sh
RUN chmod +x /compile_page.sh

# Install dependencies and customize sandbox
WORKDIR /home/user/nextjs-app

RUN npx --yes create-next-app@15.3.3 . --yes

RUN npx --yes shadcn@2.6.3 init --yes -b neutral --force
RUN npx --yes shadcn@2.6.3 add --all --yes

# Move the Nextjs app to the home directory (including hidden files) and remove the nextjs-app directory
RUN cp -a /home/user/nextjs-app/. /home/user/ && rm -rf /home/user/nextjs-app

# Switch to final working directory and install additional packages
WORKDIR /home/user

RUN npm install tw-animate-css tailwind-merge clsx --yes

# Create lib/utils.ts if shadcn didn't generate it
RUN mkdir -p /home/user/lib && \
    printf 'import { clsx, type ClassValue } from "clsx"\nimport { twMerge } from "tailwind-merge"\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs))\n}\n' > /home/user/lib/utils.ts
