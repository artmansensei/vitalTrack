-- Create the main Nutrition database
CREATE DATABASE VitalTrackNutrition;
GO

USE VitalTrackNutrition;
GO

-- Create the FoodItems table with a Primary Key constraint
CREATE TABLE FoodItems (
    FoodID INT IDENTITY(1,1) NOT NULL,
    FoodName NVARCHAR(255) NOT NULL,
    ServingSize NVARCHAR(100),
    Calories INT NOT NULL,
    ProteinGRAMS DECIMAL(5,2),
    CarbsGRAMS DECIMAL(5,2),
    FatsGRAMS DECIMAL(5,2),
    
    -- Defining the primary constraint
    CONSTRAINT PK_FoodItems PRIMARY KEY CLUSTERED (FoodID)
);
GO

-- Create a Non-Clustered Index on FoodName to speed up the "Food Logger" search function
CREATE NONCLUSTERED INDEX IX_FoodItems_FoodName 
ON FoodItems (FoodName);
GO